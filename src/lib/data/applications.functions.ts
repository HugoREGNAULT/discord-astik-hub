/**
 * Server functions pour les candidatures à la PunkAstik :
 * - submitApplication : un user Discord connecté soumet sa candidature
 * - getMyApplication  : statut de sa propre candidature
 * - listApplications  : recruteurs / staff voient les candidatures
 * - decideApplication : accepter / refuser (perm recruit.access)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { sendDiscordDM } from "@/lib/discord/dm.server";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";
import { addGuildMemberRole } from "@/lib/discord/api.server";
import { GUILDS, ROLES } from "@/lib/discord/constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

const COUNTRIES = ["Belgique", "France", "Canada", "Outre-Mer", "Autre"] as const;
const GRADES = ["Aucun", "Héros", "Légende", "Divinité", "Staff", "Affilié"] as const;

const applicationSchema = z.object({
  mcName: z
    .string()
    .trim()
    .min(3, "Pseudo trop court")
    .max(16, "Max 16 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  presentation: z.string().trim().min(30, "Min 30 caractères").max(3000),
  age: z.number().int().min(10).max(99),
  country: z.enum(COUNTRIES),
  schedule: z.string().trim().min(3).max(300),
  weeklyPlaytime: z.string().trim().min(1).max(100),
  firstVersion: z.string().trim().min(1).max(50),
  igGrade: z.enum(GRADES),
  previousFactions: z.string().trim().max(1000).optional().default(""),
  heardFrom: z.string().trim().min(2).max(300),
  skills: z.string().trim().min(2).max(1000),
  knowledgeLevel: z.number().int().min(0).max(10),
});

async function fetchMojang(name: string): Promise<{ id: string; name: string }> {
  const res = await fetchWithRetry(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
    {},
    { retries: 3, timeoutMs: 8000 },
  );
  if (res.status === 404) throw new Error("Ce pseudo Minecraft n'existe pas.");
  if (!res.ok)
    throw new Error(
      "Impossible de vérifier le pseudo (API Mojang temporairement indisponible, réessaie dans un instant).",
    );
  const body = (await res.json()) as { id?: string; name?: string };
  if (!body.id || !body.name) throw new Error("Réponse Mojang invalide.");
  return { id: body.id, name: body.name };
}

const RATE_LIMIT_HOURS = 6;

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();

    // Vérifie qu'il n'a pas déjà une candidature en attente
    const existing = await db
      .from("applications")
      .select("id, status")
      .eq("discord_id", user.discordId)
      .in("status", ["pending"])
      .maybeSingle();
    if (existing.data) {
      throw new Error("Tu as déjà une candidature en attente.");
    }

    // Rate-limit : pas plus d'une candidature toutes les RATE_LIMIT_HOURS heures
    // (empêche le spam après refus).
    const since = new Date(Date.now() - RATE_LIMIT_HOURS * 3600 * 1000).toISOString();
    const recent = await db
      .from("applications")
      .select("id, created_at")
      .eq("discord_id", user.discordId)
      .gte("created_at", since)
      .limit(1);
    if (recent.data && recent.data.length > 0) {
      throw new Error(
        `Tu dois attendre ${RATE_LIMIT_HOURS}h entre deux candidatures. Reviens plus tard.`,
      );
    }

    // Si déjà membre, pas besoin de candidater
    const isMember = await db
      .from("members")
      .select("discord_id, ig_name")
      .eq("discord_id", user.discordId)
      .maybeSingle();
    if (isMember.data?.ig_name) {
      throw new Error("Tu es déjà membre de la PunkAstik.");
    }

    // Validation du pseudo Minecraft
    const mojang = await fetchMojang(data.mcName);

    const ins = await db
      .from("applications")
      .insert({
        discord_id: user.discordId,
        discord_username: user.username,
        mc_name: mojang.name,
        presentation: data.presentation,
        age: data.age,
        country: data.country,
        schedule: data.schedule,
        weekly_playtime: data.weeklyPlaytime,
        first_version: data.firstVersion,
        ig_grade: data.igGrade,
        previous_factions: data.previousFactions || null,
        heard_from: data.heardFrom,
        skills: data.skills,
        knowledge_level: data.knowledgeLevel,
        status: "pending",
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    await logAction("application_submit", user.discordId, {
      application_id: ins.data.id,
      mc_name: mojang.name,
    });

    await logToDiscord("site", {
      title: "📝 Nouvelle candidature",
      color: COLORS.info,
      description: `**${user.username}** (<@${user.discordId}>) a candidaté à la PunkAstik.`,
      fields: [
        { name: "Pseudo MC", value: mojang.name, inline: true },
        { name: "Âge", value: String(data.age), inline: true },
        { name: "Pays", value: data.country, inline: true },
        { name: "Grade IG", value: data.igGrade, inline: true },
        { name: "Temps de jeu", value: data.weeklyPlaytime, inline: true },
        { name: "Niveau /10", value: String(data.knowledgeLevel), inline: true },
      ],
      footer: { text: `Application ${ins.data.id}` },
    });

    return { ok: true, applicationId: ins.data.id };
  });

export const getMyApplication = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const res = await db
    .from("applications")
    .select("id, status, created_at, decided_at, decision_reason, mc_name")
    .eq("discord_id", user.discordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data ?? null;
});

export const listApplications = createServerFn({ method: "GET" })
  .inputValidator((input: { status?: "pending" | "accepted" | "rejected" }) => input ?? {})
  .handler(async ({ data }) => {
    await requirePermission("recruit.access");
    const { findBlacklistMatches } = await import("@/lib/data/blacklist.server");
    const q = db.from("applications").select("*").order("created_at", { ascending: false });
    if (data.status) q.eq("status", data.status);
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []).filter((r) => (r.mc_name ?? "").toLowerCase() !== "unknown");

    // Enrichit chaque candidature avec les matchs blacklist (visible staff uniquement).
    const enriched = await Promise.all(
      rows.map(async (app) => {
        const matches = await findBlacklistMatches({
          discordId: app.discord_id,
          mcName: app.mc_name,
        });
        return { ...app, blacklist_matches: matches };
      }),
    );
    return enriched;
  });

export const getApplicationStats = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("recruit.access");
  const { findBlacklistMatches } = await import("@/lib/data/blacklist.server");
  const res = await db
    .from("applications")
    .select("discord_id, mc_name, status, created_at")
    .order("created_at", { ascending: true });
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []).filter((r) => (r.mc_name ?? "").toLowerCase() !== "unknown");

  const uniqueIds = new Set(rows.map((r) => r.discord_id));
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  for (const r of rows) {
    if (r.status === "accepted") accepted++;
    else if (r.status === "rejected") rejected++;
    else if (r.status === "pending") pending++;
  }

  // Compte blacklistés (par discord_id unique)
  let blacklisted = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.discord_id)) continue;
    seen.add(r.discord_id);
    const matches = await findBlacklistMatches({
      discordId: r.discord_id,
      mcName: r.mc_name,
    });
    if (matches.length > 0) blacklisted++;
  }

  // Série temporelle par mois
  const monthly = new Map<
    string,
    { month: string; total: number; accepted: number; rejected: number; pending: number }
  >();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let entry = monthly.get(key);
    if (!entry) {
      entry = { month: key, total: 0, accepted: 0, rejected: 0, pending: 0 };
      monthly.set(key, entry);
    }
    entry.total++;
    if (r.status === "accepted") entry.accepted++;
    else if (r.status === "rejected") entry.rejected++;
    else if (r.status === "pending") entry.pending++;
  }
  const timeline = Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month));

  return {
    unique: uniqueIds.size,
    total: rows.length,
    accepted,
    rejected,
    pending,
    blacklisted,
    timeline,
  };
});

const decideSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(1000).optional().default(""),
});

export const decideApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => decideSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("recruit.access");

    const appRes = await db
      .from("applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appRes.error) throw new Error(appRes.error.message);
    if (!appRes.data) throw new Error("Candidature introuvable.");
    if (appRes.data.status !== "pending") {
      throw new Error("Cette candidature a déjà été traitée.");
    }
    const app = appRes.data;

    const upd = await db
      .from("applications")
      .update({
        status: data.decision,
        decided_by_discord_id: staff.discordId,
        decided_by_username: staff.username,
        decided_at: new Date().toISOString(),
        decision_reason: data.reason || null,
      })
      .eq("id", data.applicationId);
    if (upd.error) throw new Error(upd.error.message);

    // Sur acceptation : créer / mettre à jour la fiche membre
    if (data.decision === "accepted") {
      // Récup UUID Minecraft
      let mcUuid: string | null = null;
      try {
        const m = await fetchMojang(app.mc_name);
        mcUuid = m.id;
      } catch {
        mcUuid = null;
      }

      await db.from("members").upsert(
        {
          discord_id: app.discord_id,
          discord_username: app.discord_username,
          ig_name: app.mc_name,
          mc_uuid: mcUuid,
          arrival_date: new Date().toISOString().slice(0, 10),
          recruiter_discord_id: staff.discordId,
          status: "active",
        },
        { onConflict: "discord_id" },
      );
    }

    // Notification DM Discord
    const message =
      data.decision === "accepted"
        ? `🎉 **Bienvenue dans la PunkAstik !**\n\nTa candidature a été acceptée par **${staff.username}**.\nTu peux désormais accéder à ton espace membre : https://discord-astik-hub.lovable.app/me${
            data.reason ? `\n\n💬 ${data.reason}` : ""
          }`
        : `❌ **Candidature refusée**\n\nDésolé, ta candidature à la PunkAstik n'a pas été retenue par **${staff.username}**.${
            data.reason ? `\n\n💬 Motif : ${data.reason}` : ""
          }`;
    const dm = await sendDiscordDM(app.discord_id, message);

    await logAction(
      data.decision === "accepted" ? "application_accept" : "application_reject",
      staff.discordId,
      {
        application_id: app.id,
        candidate: app.discord_id,
        dm_ok: dm.ok,
        dm_error: dm.error ?? null,
      },
    );

    await logToDiscord("site", {
      title: data.decision === "accepted" ? "✅ Candidature acceptée" : "❌ Candidature refusée",
      color: data.decision === "accepted" ? COLORS.success : COLORS.danger,
      description: `Candidature de **${app.discord_username}** (\`${app.mc_name}\`) traitée par **${staff.username}**.`,
      fields: [
        { name: "Candidat", value: `<@${app.discord_id}>`, inline: true },
        { name: "Décision par", value: `<@${staff.discordId}>`, inline: true },
        { name: "DM envoyé", value: dm.ok ? "Oui" : `Non (${dm.error ?? "?"})`, inline: true },
        ...(data.reason ? [{ name: "Motif", value: data.reason }] : []),
      ],
    });

    return { ok: true, dmOk: dm.ok, dmError: dm.error ?? null };
  });
