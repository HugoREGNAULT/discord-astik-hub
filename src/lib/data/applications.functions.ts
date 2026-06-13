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
import { userError, stripUserMsgPrefix } from "@/lib/errors";
import { sendDiscordDM } from "@/lib/discord/dm.server";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";
import { addGuildMemberRole, removeGuildMemberRole } from "@/lib/discord/api.server";
import { GUILDS, ROLES, CHANNELS } from "@/lib/discord/constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

const COUNTRIES = ["Belgique", "France", "Canada", "Outre-Mer", "Autre"] as const;

const applicationSchema = z.object({
  heardFrom: z.string().trim().min(2, "Champ requis").max(600),
  mcName: z
    .string()
    .trim()
    .min(3, "Pseudo trop court")
    .max(16, "Max 16 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  presentationIrl: z.string().trim().min(150, "Min 150 caractères").max(3000),
  age: z.number().int().min(10).max(99),
  country: z.enum(COUNTRIES),
  presentationGaming: z.string().trim().min(250, "Min 250 caractères").max(3000),
  schedule: z.string().trim().min(2, "Champ requis").max(600),
  objectives: z.string().trim().min(2, "Champ requis").max(2000),
  pvpLevel: z.number().int().min(1).max(10),
  motivation: z.string().trim().min(2, "Champ requis").max(2000),
  additionalInfo: z.string().trim().max(2000).optional().default(""),
  formRating: z.number().min(0.5).max(5).multipleOf(0.5).optional(),
});

async function fetchMojang(name: string): Promise<{ id: string; name: string }> {
  // Cascade :
  // 1) PlayerDB.co — proxy tiers stable, NON bloqué par anti-scraping Mojang
  //    (Mojang blackliste régulièrement les IPs cloud / serverless).
  // 2) api.minecraftservices.com — endpoint officiel actuel.
  // 3) api.mojang.com — ancien endpoint, gardé en dernier recours.
  // UA explicite + Accept JSON pour les endpoints Mojang directs.
  const headers = {
    "User-Agent": "PunkAstik-Site/1.0 (+https://punkastik.com)",
    Accept: "application/json",
  };

  // --- 1) PlayerDB
  try {
    const res = await fetchWithRetry(
      `https://playerdb.co/api/player/minecraft/${encodeURIComponent(name)}`,
      { headers },
      { retries: 2, timeoutMs: 8000 },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        success?: boolean;
        code?: string;
        data?: { player?: { username?: string; raw_id?: string } };
      };
      if (body.success && body.data?.player?.raw_id && body.data.player.username) {
        return { id: body.data.player.raw_id, name: body.data.player.username };
      }
      // success:false → si c'est un pseudo invalide, on bascule sur Mojang
      // qui sait répondre 404 proprement (PlayerDB confond parfois).
    }
  } catch {
    // ignore, on tente Mojang.
  }

  // --- 2-3) Mojang direct (avec UA)
  const mojangEndpoints = [
    `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(name)}`,
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
  ];
  let lastStatus = 0;
  for (const url of mojangEndpoints) {
    try {
      const res = await fetchWithRetry(url, { headers }, { retries: 2, timeoutMs: 8000 });
      if (res.status === 404) throw userError("Ce pseudo Minecraft n'existe pas.");
      if (!res.ok) {
        lastStatus = res.status;
        continue;
      }
      const body = (await res.json()) as { id?: string; name?: string };
      if (!body.id || !body.name) throw userError("Réponse Mojang invalide.");
      return { id: body.id, name: body.name };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("n'existe pas") || msg.includes("Réponse Mojang invalide")) throw e;
      lastStatus = lastStatus || -1;
    }
  }
  throw userError(
    `Impossible de vérifier le pseudo (services Mojang temporairement indisponibles${
      lastStatus > 0 ? `, HTTP ${lastStatus}` : ""
    }, réessaie dans quelques minutes).`,
  );
}

const RATE_LIMIT_HOURS = 6;

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    try {
      return await submitApplicationInner(user, data);
    } catch (e) {
      const err = e as Error;
      // Message nettoyé du marqueur "destiné à l'utilisateur" pour des logs lisibles.
      const cleanMsg = stripUserMsgPrefix(err.message ?? "unknown");
      // Log structuré : permet d'identifier les bugs de dépôt (Mojang KO,
      // RLS, rate-limit, blacklist DB en erreur, etc.)
      await logAction(
        "application_submit_failed",
        user.discordId,
        {
          mc_name: data.mcName,
          error: cleanMsg.slice(0, 500),
        },
        "warn",
      );
      void logToDiscord("error", {
        title: "⚠️ Échec dépôt candidature",
        color: COLORS.warn,
        description: `**${user.username}** (<@${user.discordId}>) — \`${data.mcName}\``,
        fields: [{ name: "Erreur", value: "```" + cleanMsg.slice(0, 900) + "```" }],
      });
      throw e;
    }
  });

async function submitApplicationInner(
  user: { discordId: string; username: string },
  data: z.infer<typeof applicationSchema>,
) {
  {
    // Vérifie qu'il n'a pas déjà une candidature en attente
    const existing = await db
      .from("applications")
      .select("id, status")
      .eq("discord_id", user.discordId)
      .in("status", ["pending"])
      .maybeSingle();
    if (existing.data) {
      throw userError("Tu as déjà une candidature en attente.");
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
      throw userError(
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
      throw userError("Tu es déjà membre de la PunkAstik.");
    }

    // Validation du pseudo Minecraft
    const mojang = await fetchMojang(data.mcName);

    // Détection blacklist (discord_id + pseudo MC + UUID)
    const { findBlacklistMatches } = await import("@/lib/data/blacklist.server");
    const blacklistMatches = await findBlacklistMatches({
      discordId: user.discordId,
      mcName: mojang.name,
      mcUuid: mojang.id,
    });

    const ins = await db
      .from("applications")
      .insert({
        discord_id: user.discordId,
        discord_username: user.username,
        mc_name: mojang.name,
        presentation: data.presentationIrl,
        presentation_gaming: data.presentationGaming,
        age: data.age,
        country: data.country,
        schedule: data.schedule,
        objectives: data.objectives,
        pvp_level: data.pvpLevel,
        motivation: data.motivation,
        heard_from: data.heardFrom,
        additional_info: data.additionalInfo || null,
        form_rating: data.formRating ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    await logAction("application_submit", user.discordId, {
      application_id: ins.data.id,
      mc_name: mojang.name,
      blacklist_hits: blacklistMatches.length,
    });

    const blacklistField =
      blacklistMatches.length > 0
        ? [
            {
              name: "⚠️ BLACKLIST DÉTECTÉE",
              value: blacklistMatches
                .slice(0, 5)
                .map(
                  (m) =>
                    `• matchs : ${m.matched_on.join(", ")} — *${m.reason || "sans motif"}* (par ${m.added_by_username ?? "?"})`,
                )
                .join("\n"),
            },
          ]
        : [];

    await logToDiscord("site", {
      title: blacklistMatches.length > 0 ? "⚠️ Candidature — BLACKLIST" : "📝 Nouvelle candidature",
      color: blacklistMatches.length > 0 ? COLORS.danger : COLORS.info,
      description: `**${user.username}** (<@${user.discordId}>) a candidaté à la PunkAstik.${
        blacklistMatches.length > 0
          ? `\n\n🚨 **${blacklistMatches.length} entrée(s) blacklist** correspondent à ce candidat.`
          : ""
      }`,
      fields: [
        { name: "Pseudo MC", value: mojang.name, inline: true },
        { name: "Âge", value: String(data.age), inline: true },
        { name: "Pays", value: data.country, inline: true },
        { name: "PvP /10", value: String(data.pvpLevel), inline: true },
        ...blacklistField,
      ],
      footer: { text: `Application ${ins.data.id}` },
    });

    // Notif cross-post dans le salon recrutement (silencieux si non configuré).
    const { postNotify } = await import("@/lib/discord/log.server");
    const { NOTIFY_CHANNELS } = await import("@/lib/discord/constants");
    void postNotify(NOTIFY_CHANNELS.RECRUIT, {
      title: "📝 Nouvelle candidature à examiner",
      color: blacklistMatches.length > 0 ? COLORS.danger : COLORS.info,
      description: `**${user.username}** (<@${user.discordId}>) — \`${mojang.name}\``,
      fields: [
        { name: "Âge", value: String(data.age), inline: true },
        { name: "Pays", value: data.country, inline: true },
        { name: "PvP /10", value: String(data.pvpLevel), inline: true },
        ...(blacklistMatches.length > 0
          ? [{ name: "⚠️ Blacklist", value: `${blacklistMatches.length} match(s)` }]
          : []),
      ],
      footer: { text: `Application ${ins.data.id}` },
    });

    return { ok: true, applicationId: ins.data.id, blacklistHits: blacklistMatches.length };
  }
}

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
  .inputValidator(
    (input: { status?: "pending" | "accepted" | "rejected" | "interview_validated" }) =>
      input ?? {},
  )
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
    if (appRes.data.status === data.decision) {
      throw new Error(
        `Cette candidature est déjà ${data.decision === "accepted" ? "acceptée" : "refusée"}.`,
      );
    }
    const previousStatus = appRes.data.status as "pending" | "accepted" | "rejected";
    const isRedecision = previousStatus !== "pending";
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

    // Sur acceptation (écrite) : on attribue simplement le rôle "attente
    // d'entretien" + DM demandant les dispos. La création de fiche membre
    // est repoussée à `validateInterview` (étape 2, après l'entretien).
    let roleAssigned: { ok: boolean; error?: string } = { ok: false };
    if (data.decision === "accepted") {
      const r = await addGuildMemberRole(
        GUILDS.PUBLIC,
        app.discord_id,
        ROLES.INTERVIEW_PENDING_PUBLIC,
      );
      roleAssigned = { ok: r.ok, error: r.error };
    }

    // Notification DM Discord
    const message =
      data.decision === "accepted"
        ? `✅ **Candidature écrite validée !**\n\nBonne nouvelle, ta candidature à la PunkAstik a été retenue à l'écrit par **${staff.username}**.\n\n🎤 Prochaine étape : **l'entretien vocal**. Indique-nous tes disponibilités dans le salon <#${CHANNELS.INTERVIEW_AVAILABILITY}> dès que possible.${
            data.reason ? `\n\n💬 ${data.reason}` : ""
          }`
        : `❌ **Candidature refusée**\n\nDésolé, ta candidature à la PunkAstik n'a pas été retenue par **${staff.username}**.${
            data.reason ? `\n\n💬 Motif : ${data.reason}` : ""
          }`;
    const dm = await sendDiscordDM(app.discord_id, message);

    await logAction(
      isRedecision
        ? "application_redecide"
        : data.decision === "accepted"
          ? "application_accept"
          : "application_reject",
      staff.discordId,
      {
        application_id: app.id,
        candidate: app.discord_id,
        previous_status: previousStatus,
        new_status: data.decision,
        dm_ok: dm.ok,
        dm_error: dm.error ?? null,
        role_assigned: data.decision === "accepted" ? roleAssigned.ok : null,
        role_error: data.decision === "accepted" ? (roleAssigned.error ?? null) : null,
      },
    );

    await logToDiscord("site", {
      title: isRedecision
        ? `🔄 Décision modifiée — ${data.decision === "accepted" ? "acceptée" : "refusée"}`
        : data.decision === "accepted"
          ? "✅ Candidature acceptée (écrite)"
          : "❌ Candidature refusée",
      color: data.decision === "accepted" ? COLORS.success : COLORS.danger,
      description: `Candidature de **${app.discord_username}** (\`${app.mc_name}\`) ${isRedecision ? `re-traitée (de \`${previousStatus}\` → \`${data.decision}\`)` : "traitée"} par **${staff.username}**.${
        data.decision === "accepted" && !isRedecision
          ? "\n\n*En attente d'entretien — rôle public attribué.*"
          : ""
      }`,
      fields: [
        { name: "Candidat", value: `<@${app.discord_id}>`, inline: true },
        { name: "Décision par", value: `<@${staff.discordId}>`, inline: true },
        { name: "DM envoyé", value: dm.ok ? "Oui" : `Non (${dm.error ?? "?"})`, inline: true },
        ...(data.decision === "accepted"
          ? [
              {
                name: "Rôle entretien",
                value: roleAssigned.ok ? "Attribué ✅" : `Échec (${roleAssigned.error ?? "?"})`,
                inline: true,
              },
            ]
          : []),
        ...(data.reason ? [{ name: "Motif", value: data.reason }] : []),
      ],
    });

    const { notify } = await import("@/lib/data/notify.server");
    void notify({
      recipientDiscordId: app.discord_id,
      kind: "application",
      title:
        data.decision === "accepted" ? "✅ Candidature écrite validée" : "❌ Candidature refusée",
      detail:
        data.decision === "accepted"
          ? `Donne tes dispos pour l'entretien dans le salon prévu.`
          : data.reason || undefined,
      href: "/me",
    });

    return {
      ok: true,
      dmOk: dm.ok,
      dmError: dm.error ?? null,
      roleAssigned: data.decision === "accepted" ? roleAssigned.ok : null,
    };
  });

// ===========================================================================
// Étape 2 : Entretien validé → titularisation en période d'essai
// ===========================================================================

const validateInterviewSchema = z.object({
  applicationId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional().default(""),
});

export const validateInterview = createServerFn({ method: "POST" })
  .inputValidator((input) => validateInterviewSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("recruit.access");

    const appRes = await db
      .from("applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appRes.error) throw new Error(appRes.error.message);
    if (!appRes.data) throw new Error("Candidature introuvable.");
    const app = appRes.data;
    if (app.status !== "accepted" && app.status !== "interview_validated") {
      throw new Error(
        "L'entretien ne peut être validé que sur une candidature acceptée à l'écrit.",
      );
    }
    const alreadyValidated = app.status === "interview_validated";

    // Tentative des 3 rôles + retrait rôle attente (continue même en cas d'échec)
    const [memberPublic, trialFaction, memberFaction, removeInterview] = await Promise.all([
      addGuildMemberRole(GUILDS.PUBLIC, app.discord_id, ROLES.MEMBER_PUBLIC),
      addGuildMemberRole(GUILDS.FACTION, app.discord_id, ROLES.TRIAL_FACTION),
      addGuildMemberRole(GUILDS.FACTION, app.discord_id, ROLES.MEMBER_FACTION),
      removeGuildMemberRole(GUILDS.PUBLIC, app.discord_id, ROLES.INTERVIEW_PENDING_PUBLIC),
    ]);

    const roleResults = {
      member_public: memberPublic,
      trial_faction: trialFaction,
      member_faction: memberFaction,
      removed_interview_pending: removeInterview,
    };
    const roleWarnings: string[] = [];
    if (!memberPublic.ok)
      roleWarnings.push(`Rôle membre public échoué (${memberPublic.error ?? memberPublic.status})`);
    if (!trialFaction.ok)
      roleWarnings.push(
        `Rôle essai privé échoué (${trialFaction.error ?? trialFaction.status}) — la personne a-t-elle rejoint le serveur privé ?`,
      );
    if (!memberFaction.ok)
      roleWarnings.push(
        `Rôle membre faction échoué (${memberFaction.error ?? memberFaction.status}) — la personne a-t-elle rejoint le serveur privé ?`,
      );

    // Fiche membre en essai 14j (idempotent)
    const trialUntil = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const trialUntilIso = trialUntil.toISOString();
    const arrivalDate = new Date().toISOString().slice(0, 10);

    const existing = await db
      .from("members")
      .select("discord_id, status")
      .eq("discord_id", app.discord_id)
      .maybeSingle();
    if (existing.data) {
      // Ne dégrade pas un membre déjà titularisé ('active') : on touche
      // uniquement si la fiche n'existe pas encore en active.
      if (existing.data.status !== "active") {
        await db
          .from("members")
          .update({
            discord_username: app.discord_username,
            ig_name: app.mc_name,
            status: "trial",
            trial_until: trialUntilIso,
            arrival_date: arrivalDate,
          })
          .eq("discord_id", app.discord_id);
      }
    } else {
      await db.from("members").insert({
        discord_id: app.discord_id,
        discord_username: app.discord_username,
        ig_name: app.mc_name,
        status: "trial",
        trial_until: trialUntilIso,
        arrival_date: arrivalDate,
        recruiter_discord_id: staff.discordId,
      });
    }

    // Onboarding tasks par défaut (idempotent)
    const existingTasks = await db
      .from("onboarding_tasks")
      .select("id")
      .eq("member_discord_id", app.discord_id)
      .limit(1);
    if (!existingTasks.data || existingTasks.data.length === 0) {
      const defaults = [
        { key: "discord_faction", label: "Rejoindre le Discord faction" },
        { key: "base_setup", label: "Configurer sa base / claim" },
        { key: "first_raid", label: "Participer à un 1er raid" },
        { key: "rules_read", label: "Lire le règlement" },
      ];
      await db.from("onboarding_tasks").insert(
        defaults.map((t, i) => ({
          member_discord_id: app.discord_id,
          label: t.label,
          template_key: t.key,
          display_order: i,
        })),
      );
    }

    // MAJ statut candidature
    if (!alreadyValidated) {
      await db
        .from("applications")
        .update({
          status: "interview_validated",
          interview_validated_at: new Date().toISOString(),
          interview_validated_by_discord_id: staff.discordId,
          interview_validated_by_username: staff.username,
        })
        .eq("id", app.id);
    }

    // DM bienvenue
    const trialDateStr = trialUntil.toLocaleDateString("fr-FR");
    const dmMessage = `🎉 **Bienvenue dans la PunkAstik !**\n\nTon entretien a été validé par **${staff.username}**. Tu es maintenant en **période d'essai jusqu'au ${trialDateStr}**.\n\nPendant cette période, complète les tâches d'onboarding sur ton espace perso et fais bonne impression — le staff votera ensuite pour ta titularisation.${
      data.reason ? `\n\n💬 ${data.reason}` : ""
    }`;
    const dm = await sendDiscordDM(app.discord_id, dmMessage);

    await logAction("application_interview_validated", staff.discordId, {
      application_id: app.id,
      candidate: app.discord_id,
      already_validated: alreadyValidated,
      dm_ok: dm.ok,
      dm_error: dm.error ?? null,
      role_results: {
        member_public: {
          ok: memberPublic.ok,
          status: memberPublic.status,
          error: memberPublic.error ?? null,
        },
        trial_faction: {
          ok: trialFaction.ok,
          status: trialFaction.status,
          error: trialFaction.error ?? null,
        },
        member_faction: {
          ok: memberFaction.ok,
          status: memberFaction.status,
          error: memberFaction.error ?? null,
        },
        removed_interview_pending: {
          ok: removeInterview.ok,
          status: removeInterview.status,
          error: removeInterview.error ?? null,
        },
      },
    });

    await logToDiscord("site", {
      title: "🎤 Entretien validé",
      color: COLORS.success,
      description: `**${app.discord_username}** (\`${app.mc_name}\`) titularisé en essai (14j) par **${staff.username}**.${
        roleWarnings.length > 0 ? `\n\n⚠️ ${roleWarnings.length} alerte(s) sur les rôles.` : ""
      }`,
      fields: [
        { name: "Candidat", value: `<@${app.discord_id}>`, inline: true },
        { name: "Par", value: `<@${staff.discordId}>`, inline: true },
        { name: "DM envoyé", value: dm.ok ? "Oui" : `Non (${dm.error ?? "?"})`, inline: true },
        {
          name: "Rôles",
          value: [
            `• Membre public : ${memberPublic.ok ? "✅" : `❌ ${memberPublic.error ?? memberPublic.status}`}`,
            `• Essai privé : ${trialFaction.ok ? "✅" : `❌ ${trialFaction.error ?? trialFaction.status}`}`,
            `• Membre faction : ${memberFaction.ok ? "✅" : `❌ ${memberFaction.error ?? memberFaction.status}`}`,
            `• Retrait attente : ${removeInterview.ok ? "✅" : `❌ ${removeInterview.error ?? removeInterview.status}`}`,
          ].join("\n"),
        },
        ...(data.reason ? [{ name: "Note", value: data.reason }] : []),
      ],
    });

    const { notify } = await import("@/lib/data/notify.server");
    void notify({
      recipientDiscordId: app.discord_id,
      kind: "application",
      title: "🎉 Bienvenue en période d'essai",
      detail: `Tu es membre essai jusqu'au ${trialDateStr}.`,
      href: "/me",
    });

    return {
      ok: true,
      dmOk: dm.ok,
      dmError: dm.error ?? null,
      roleResults,
      roleWarnings,
      trialUntil: trialUntilIso,
    };
  });
