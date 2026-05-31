/**
 * Liaison Minecraft ↔ Discord par challenge à code.
 *
 * =====================================================================
 *  AUDIT API PALADIUM — résultat (NE PAS PASSER OUTRE)
 * ---------------------------------------------------------------------
 *  Inspection de `src/lib/paladium/api.ts` (PaladiumApi) :
 *   - `getPlayerProfile(uuid)` expose : username, factionName, rank, money,
 *     level, experience, firstJoin… AUCUN n'est librement modifiable par le
 *     joueur à la demande pour y coller un code de vérification.
 *   - `getFaction(name)` expose `description` MAIS celle-ci n'est modifiable
 *     que par le chef de faction, pas par un membre individuel.
 *   - `getPaladiumProfile(uuid)` (clicker) : coins/buildings : pas de champ
 *     texte arbitraire.
 *   - Aucun endpoint Paladium ne lit un "bio" / "description" / "status"
 *     de joueur.
 *
 *  CONCLUSION : la preuve "le joueur écrit un code, on le relit via l'API
 *  Paladium" N'EST PAS RÉALISABLE avec l'API actuelle. On NE prétend PAS
 *  qu'elle l'est.
 *
 *  FALLBACK retenu : le membre poste son code dans un salon Discord
 *  vérifié (configuré côté bot). Le bot F2 lit le message et appelle
 *  POST /api/public/bot/mc-link-confirm avec { discordId, code } et le
 *  header `x-bot-key`. C'est seulement à ce moment qu'on marque le
 *  challenge `verified` et qu'on écrit `members.mc_uuid`.
 *
 *  Côté front, `verifyMcLink` se contente de RELIRE le statut courant
 *  du challenge de l'utilisateur (polling) — il ne triche pas, il ne
 *  marque jamais lui-même verified.
 * =====================================================================
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, logAction } from "@/lib/auth/require.server";
import { sendDiscordDM } from "@/lib/discord/dm.server";

const CHALLENGE_TTL_MIN = 15;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I
const CODE_LEN = 6;

function generateCode(): string {
  let code = "";
  const buf = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(buf);
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return code;
}

function normalizeUuid(id: string): string {
  const s = id.replace(/-/g, "");
  if (s.length !== 32) return id;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function mojangLookup(username: string): Promise<{ uuid: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    );
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) return null;
    const j = (await res.json()) as { id: string; name: string };
    return { uuid: normalizeUuid(j.id), name: j.name };
  } catch {
    return null;
  }
}

/* ===== startMcLink ===== */

export interface StartMcLinkResult {
  ok: true;
  code: string;
  expires_at: string;
  dm_sent: boolean;
  dm_error?: string;
}

export const startMcLink = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        mcName: z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(/^[A-Za-z0-9_]+$/, "Pseudo Minecraft invalide"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<StartMcLinkResult> => {
    const user = await requireSession();

    // 1. Résolution UUID Mojang (le pseudo doit exister, sinon on bloque tôt).
    const moj = await mojangLookup(data.mcName);
    if (!moj) {
      throw new Error(`Pseudo "${data.mcName}" introuvable sur Mojang.`);
    }

    // 2. On invalide tous les pendings de cet utilisateur (un seul actif).
    await db
      .from("mc_link_challenges")
      .update({ status: "expired" })
      .eq("discord_id", user.discordId)
      .eq("status", "pending");

    // 3. On crée le challenge — discord_id = SESSION USER (impossible de lier
    //    un compte tiers).
    const code = generateCode();
    const expires_at = new Date(Date.now() + CHALLENGE_TTL_MIN * 60_000).toISOString();

    const { error } = await db.from("mc_link_challenges").insert({
      discord_id: user.discordId,
      mc_name: moj.name,
      mc_uuid: moj.uuid,
      code,
      status: "pending",
      expires_at,
    });
    if (error) throw new Error(error.message);

    // 4. DM avec instructions issues de l'audit (fallback Discord).
    const dmText =
      `Bonjour ${user.globalName ?? user.username} 👋\n\n` +
      `Tu viens de demander à lier ton pseudo Minecraft **${moj.name}**.\n\n` +
      `**Ton code de vérification :** \`${code}\`\n` +
      `(valide ${CHALLENGE_TTL_MIN} minutes)\n\n` +
      `**Comment valider ?**\n` +
      `1. Va dans le salon Discord de vérification de la faction.\n` +
      `2. Poste exactement : \`!link ${code}\`\n` +
      `3. Le bot confirmera automatiquement la liaison.\n\n` +
      `_Note : l'API Paladium ne permet pas de prouver la propriété d'un pseudo, ` +
      `la vérification passe donc par le bot Discord. Ton code ne sera jamais accepté ` +
      `pour un autre compte que le tien._`;

    const dm = await sendDiscordDM(user.discordId, dmText);

    await logAction("mc_link.start", user.discordId, {
      mc_name: moj.name,
      mc_uuid: moj.uuid,
      dm_ok: dm.ok,
    });

    return {
      ok: true,
      code,
      expires_at,
      dm_sent: dm.ok,
      dm_error: dm.error,
    };
  });

/* ===== verifyMcLink (polling côté front, lecture seule) ===== */

export interface VerifyMcLinkResult {
  status: "pending" | "verified" | "expired" | "none";
  mc_name?: string;
  mc_uuid?: string;
  expires_at?: string;
  verified_at?: string;
}

export const verifyMcLink = createServerFn({ method: "POST" })
  .handler(async (): Promise<VerifyMcLinkResult> => {
    const user = await requireSession();

    const { data: row } = await db
      .from("mc_link_challenges")
      .select("status, mc_name, mc_uuid, expires_at, verified_at")
      .eq("discord_id", user.discordId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { status: "none" };

    // Marque expiré si dépassé (utile si aucun cron n'est passé).
    if (row.status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
      await db
        .from("mc_link_challenges")
        .update({ status: "expired" })
        .eq("discord_id", user.discordId)
        .eq("status", "pending");
      return {
        status: "expired",
        mc_name: row.mc_name,
        mc_uuid: row.mc_uuid ?? undefined,
        expires_at: row.expires_at,
      };
    }

    return {
      status: row.status as VerifyMcLinkResult["status"],
      mc_name: row.mc_name,
      mc_uuid: row.mc_uuid ?? undefined,
      expires_at: row.expires_at,
      verified_at: row.verified_at ?? undefined,
    };
  });

/* ===== Helper interne appelé par le hook bot ===== */

export interface BotConfirmResult {
  ok: boolean;
  reason?: "not_found" | "expired" | "already_verified";
  mc_uuid?: string;
}

/**
 * Appelé exclusivement par /api/public/bot/mc-link-confirm après auth bot.
 * Verrouille le challenge, marque verified, écrit members.mc_uuid.
 */
export async function _botConfirmMcLink(
  discordId: string,
  code: string,
): Promise<BotConfirmResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(cleanCode)) return { ok: false, reason: "not_found" };

  const { data: row } = await db
    .from("mc_link_challenges")
    .select("id, status, mc_name, mc_uuid, expires_at")
    .eq("discord_id", discordId)
    .eq("code", cleanCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "verified") {
    return { ok: false, reason: "already_verified", mc_uuid: row.mc_uuid ?? undefined };
  }
  if (
    row.status === "expired" ||
    new Date(row.expires_at).getTime() < Date.now()
  ) {
    await db
      .from("mc_link_challenges")
      .update({ status: "expired" })
      .eq("id", row.id);
    return { ok: false, reason: "expired" };
  }

  await db
    .from("mc_link_challenges")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", row.id);

  if (row.mc_uuid) {
    await db
      .from("members")
      .update({ mc_uuid: row.mc_uuid, ig_name: row.mc_name })
      .eq("discord_id", discordId);
  }

  await logAction("mc_link.verified", discordId, {
    mc_name: row.mc_name,
    mc_uuid: row.mc_uuid,
  });

  return { ok: true, mc_uuid: row.mc_uuid ?? undefined };
}

/* ===== Lecture stats Paladium pour la fiche membre ===== */

export interface McStatsResult {
  uuid: string | null;
  latest: {
    money: number | null;
    faction_ingame: string | null;
    jobs: Array<{ name: string; level: number }>;
    snapshot_at: string;
    raw_json: string;
  } | null;
  history_count: number;
}

import { requirePermission } from "@/lib/auth/require.server";

export const getMemberMcStats = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ discordId: z.string().regex(/^\d{15,25}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<McStatsResult> => {
    await requirePermission("members.view");

    const { data: m } = await db
      .from("members")
      .select("mc_uuid")
      .eq("discord_id", data.discordId)
      .maybeSingle();
    const uuid = m?.mc_uuid ?? null;
    if (!uuid) return { uuid: null, latest: null, history_count: 0 };

    const { data: rows } = await db
      .from("mc_player_stats")
      .select("money, faction_ingame, jobs, snapshot_at, raw")
      .eq("mc_uuid", uuid)
      .order("snapshot_at", { ascending: false })
      .limit(1);

    const { count } = await db
      .from("mc_player_stats")
      .select("id", { count: "exact", head: true })
      .eq("mc_uuid", uuid);

    const r = rows?.[0];
    return {
      uuid,
      latest: r
        ? {
            money: r.money,
            faction_ingame: r.faction_ingame,
            jobs: (r.jobs as Array<{ name: string; level: number }>) ?? [],
            snapshot_at: r.snapshot_at,
            raw_json: JSON.stringify(r.raw ?? null),
          }
        : null,
      history_count: count ?? 0,
    };
  });

