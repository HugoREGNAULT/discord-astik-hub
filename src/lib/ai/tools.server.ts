/**
 * Registre des outils whitelistés exposés à l'assistant IA.
 *
 * Chaque outil :
 *  - déclare une `requiredPerm` (clé de notre table de permissions Discord)
 *  - valide ses arguments via zod (schéma JSON dérivé pour le Gateway)
 *  - re-check la perm dans `run()` avant toute lecture
 *  - reste STRICTEMENT en lecture (phase 1)
 *
 * Aucun outil ne déclenche d'écriture (warn, points, sanction…).
 */

import { z, type ZodTypeAny } from "zod";
import { db } from "@/lib/db.server";
import { canAccess, type Permission, type SessionUser } from "@/lib/auth/permissions";
import { filterFactionMembers, isFactionMember } from "@/lib/data/faction-members";
import { sanitizePostgrestLike } from "@/lib/data/postgrest";

export interface AssistantTool<TArgs = unknown> {
  name: string;
  description: string;
  requiredPerm: Permission;
  zod: ZodTypeAny;
  /** Schéma JSON simplifié pour OpenAI/Gemini tool calling. */
  parameters: Record<string, unknown>;
  run: (args: TArgs, user: SessionUser) => Promise<unknown>;
}

function guard(user: SessionUser, perm: Permission) {
  if (!canAccess(user, perm)) {
    throw new Error(`FORBIDDEN: missing permission ${perm}`);
  }
}

// ------------------ Schémas ------------------

const EmptySchema = z.object({}).strict();
const EmptyJson = { type: "object", properties: {}, additionalProperties: false };

const InactivesSchema = z.object({
  days: z.number().int().min(1).max(120).default(14),
});
const InactivesJson = {
  type: "object",
  properties: {
    days: {
      type: "number",
      description: "Nombre de jours d'inactivité (1-120). Défaut: 14.",
    },
  },
  additionalProperties: false,
};

const TopContribSchema = z.object({
  days: z.number().int().min(1).max(90).default(7),
  limit: z.number().int().min(1).max(25).default(10),
});
const TopContribJson = {
  type: "object",
  properties: {
    days: { type: "number", description: "Fenêtre en jours (1-90). Défaut: 7." },
    limit: { type: "number", description: "Nombre max de membres (1-25). Défaut: 10." },
  },
  additionalProperties: false,
};

const GetMemberSchema = z.object({
  query: z.string().trim().min(1).max(64),
});
const GetMemberJson = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Pseudo IG, username Discord ou bout de pseudo (recherche floue).",
    },
  },
  required: ["query"],
  additionalProperties: false,
};

// ------------------ Outils ------------------

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "getFactionHealth",
    description:
      "Indicateurs synthétiques de santé de la faction sur 30 jours : membres actifs, taux d'activité, arrivées, départs, turnover, top recruteurs.",
    requiredPerm: "members.view",
    zod: EmptySchema,
    parameters: EmptyJson,
    run: async (_args, user) => {
      guard(user, "members.view");
      const { getFactionHealth } = await import("@/lib/data/health.functions");
      return await getFactionHealth();
    },
  },

  {
    name: "listInactives",
    description:
      "Liste les membres de la faction sans message ni vocal sur les 7 derniers jours, considérés inactifs depuis au moins N jours (croisé avec leaderboard_snapshots quand disponible).",
    requiredPerm: "members.view",
    zod: InactivesSchema,
    parameters: InactivesJson,
    run: async (rawArgs, user) => {
      guard(user, "members.view");
      const { days } = InactivesSchema.parse(rawArgs);

      const { data } = await db
        .from("members")
        .select(
          "discord_id, ig_name, discord_username, current_grade, arrival_date, messages_7d, voice_7d_seconds, mc_uuid",
        )
        .eq("status", "active");
      const active = filterFactionMembers(data ?? []);
      const candidates = active.filter(
        (m) => (m.messages_7d ?? 0) === 0 && (m.voice_7d_seconds ?? 0) === 0,
      );

      // Croise avec leaderboard_snapshots pour estimer la durée d'inactivité.
      const sinceIso = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const ids = candidates.map((c) => c.discord_id);
      const snapsByMember = new Map<string, string>(); // last seen iso
      if (ids.length > 0) {
        const { data: snaps } = await db
          .from("leaderboard_snapshots")
          .select("discord_id, taken_at")
          .gte("taken_at", sinceIso)
          .in("discord_id", ids)
          .order("taken_at", { ascending: false })
          .limit(20_000);
        for (const s of snaps ?? []) {
          if (!snapsByMember.has(s.discord_id)) snapsByMember.set(s.discord_id, s.taken_at);
        }
      }

      const now = Date.now();
      const rows = candidates
        .map((m) => {
          const lastSeen = snapsByMember.get(m.discord_id) ?? null;
          const inactiveDays = lastSeen
            ? Math.floor((now - new Date(lastSeen).getTime()) / 86_400_000)
            : 7; // baseline (au moins une semaine)
          return {
            discord_id: m.discord_id,
            name: m.ig_name ?? m.discord_username ?? m.discord_id,
            grade: m.current_grade,
            arrival_date: m.arrival_date,
            last_seen: lastSeen,
            inactive_days: inactiveDays,
          };
        })
        .filter((r) => r.inactive_days >= days)
        .sort((a, b) => b.inactive_days - a.inactive_days);

      return { days, count: rows.length, members: rows.slice(0, 100) };
    },
  },

  {
    name: "getTopContributors",
    description:
      "Top contributeurs en AstikPoints sur une fenêtre récente (somme des mouvements positifs de points_ledger).",
    requiredPerm: "members.view",
    zod: TopContribSchema,
    parameters: TopContribJson,
    run: async (rawArgs, user) => {
      guard(user, "members.view");
      const { days, limit } = TopContribSchema.parse(rawArgs);
      const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

      const { data: ledger } = await db
        .from("points_ledger")
        .select("member_discord_id, amount")
        .gte("created_at", sinceIso)
        .limit(20_000);

      const sums = new Map<string, number>();
      for (const p of ledger ?? []) {
        if ((p.amount ?? 0) > 0) {
          sums.set(
            p.member_discord_id,
            (sums.get(p.member_discord_id) ?? 0) + (p.amount ?? 0),
          );
        }
      }
      const top = Array.from(sums.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      if (top.length === 0) return { days, contributors: [] };

      const { data: members } = await db
        .from("members")
        .select("discord_id, ig_name, discord_username, current_grade, mc_uuid, arrival_date")
        .in(
          "discord_id",
          top.map(([id]) => id),
        );
      const byId = new Map(
        filterFactionMembers(members ?? []).map((m) => [m.discord_id, m]),
      );

      const contributors = top
        .filter(([id]) => byId.has(id))
        .map(([id, points]) => {
          const m = byId.get(id);
          return {
            discord_id: id,
            name: m?.ig_name ?? m?.discord_username ?? id,
            grade: m?.current_grade,
            points,
          };
        });
      return { days, contributors };
    },
  },

  {
    name: "getMember",
    description:
      "Recherche un membre de la faction par pseudo IG ou username Discord (renvoie jusqu'à 5 correspondances avec fiche synthétique).",
    requiredPerm: "members.view",
    zod: GetMemberSchema,
    parameters: GetMemberJson,
    run: async (rawArgs, user) => {
      guard(user, "members.view");
      const { query } = GetMemberSchema.parse(rawArgs);
      const like = `%${sanitizePostgrestLike(query)}%`;
      const { data } = await db
        .from("members")
        .select(
          "discord_id, discord_username, ig_name, current_grade, status, arrival_date, messages_7d, voice_7d_seconds, mc_uuid",
        )
        .or(`discord_username.ilike.${like},ig_name.ilike.${like}`)
        .limit(15);
      const matches = (data ?? [])
        .filter((m) => isFactionMember(m))
        .slice(0, 5)
        .map((m) => ({
          discord_id: m.discord_id,
          name: m.ig_name ?? m.discord_username ?? m.discord_id,
          discord_username: m.discord_username,
          grade: m.current_grade,
          status: m.status,
          arrival_date: m.arrival_date,
          messages_7d: m.messages_7d,
          voice_7d_seconds: m.voice_7d_seconds,
        }));
      return { query, count: matches.length, matches };
    },
  },

  {
    name: "getApplicationsSummary",
    description:
      "Statistiques globales sur les candidatures : total, acceptées, rejetées, en attente, blacklistées, timeline mensuelle.",
    requiredPerm: "recruit.access",
    zod: EmptySchema,
    parameters: EmptyJson,
    run: async (_args, user) => {
      guard(user, "recruit.access");
      const { getApplicationStats } = await import("@/lib/data/applications.functions");
      return await getApplicationStats();
    },
  },
];

export function getToolsFor(user: SessionUser): AssistantTool[] {
  return ASSISTANT_TOOLS.filter((t) => canAccess(user, t.requiredPerm));
}
