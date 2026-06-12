/**
 * Server functions pour l'espace perso d'un membre :
 * - getMyOverview : récupère / crée la fiche du membre connecté + données pour la page d'accueil
 * - completeOnboarding : enregistre le pseudo Minecraft (+ alts optionnels) au 1er login
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, logAction } from "@/lib/auth/require.server";
import { isFactionMember, filterFactionMembers } from "@/lib/data/faction-members";
import { ROLE_TAG_IDS, MAX_ROLE_TAGS, MAX_BIO_LENGTH } from "@/lib/profile-roles";
import {
  fetchMojangProfile,
  MojangNotFoundError,
  MojangUnavailableError,
} from "@/lib/paladium/mojang-resolve.server";

function normalizeUuid(id: string): string {
  const stripped = id.replace(/-/g, "");
  if (stripped.length !== 32) return id;
  return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
}

/** Récupère (ou crée) la fiche `members` du user connecté + données d'accueil. */
export const getMyOverview = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();

  // 1) Fiche membre (auto-create si absente)
  let { data: member, error } = await db
    .from("members")
    .select("*")
    .eq("discord_id", user.discordId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!member) {
    // Un non-membre connecté crée ici une fiche "active" minimale (status contraint en
    // base à active/former/away/left). Elle reste EXCLUE des stats et listes faction via
    // filterFactionMembers (isFactionMember = ig_name/grade/arrivée/uuid) — donc elle ne
    // pollue ni l'effectif ni "risque de départ".
    const ins = await db
      .from("members")
      .insert({
        discord_id: user.discordId,
        discord_username: user.username,
        avatar_url: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
          : null,
        status: "active",
      })
      .select("*")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    member = ins.data;
    await logAction("member_self_create", user.discordId);
  }

  const needsOnboarding = !member.mc_uuid;

  // 2) Données annexes
  const [altsRes, gainsRes, warnsRes, loginsRes] = await Promise.all([
    db.from("member_alts").select("*").eq("member_discord_id", user.discordId),
    db
      .from("points_ledger")
      .select("*")
      .eq("member_discord_id", user.discordId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("warnings")
      .select("id, created_at, body")
      .eq("member_discord_id", user.discordId)
      .order("created_at", { ascending: false })
      .limit(3),
    db
      .from("logs")
      .select("created_at")
      .eq("action", "login")
      .eq("actor_discord_id", user.discordId)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const loginRows = (loginsRes.data ?? []) as Array<{ created_at: string }>;
  // [0] = connexion actuelle, [1] = connexion précédente
  const currentLoginAt = loginRows[0]?.created_at ?? null;
  const previousLoginAt = loginRows[1]?.created_at ?? null;

  // Recruteur (lookup léger)
  let recruiter: {
    discord_id: string;
    ig_name: string | null;
    discord_username: string | null;
  } | null = null;
  if (member.recruiter_discord_id) {
    const r = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, current_grade, arrival_date, mc_uuid")
      .eq("discord_id", member.recruiter_discord_id)
      .maybeSingle();
    recruiter = r.data && isFactionMember(r.data) ? r.data : null;
  }

  return {
    member,
    needsOnboarding,
    alts: altsRes.data ?? [],
    recentGains: gainsRes.data ?? [],
    warnings: warnsRes.data ?? [],
    recruiter,
    currentLoginAt,
    previousLoginAt,
  };
});

const onboardingSchema = z.object({
  igName: z
    .string()
    .trim()
    .min(3, "Pseudo trop court")
    .max(16, "Max 16 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  alts: z
    .array(
      z.object({
        altName: z.string().trim().max(16).optional().nullable(),
        altDiscordId: z
          .string()
          .trim()
          .max(32)
          .regex(/^\d*$/, "ID Discord = chiffres uniquement")
          .optional()
          .nullable(),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});

/** Valide le pseudo MC via le resolver centralisé (cascade + UA). */
async function fetchMojang(name: string): Promise<{ id: string; name: string }> {
  try {
    return await fetchMojangProfile(name);
  } catch (e) {
    if (e instanceof MojangNotFoundError) throw new Error("Ce pseudo Minecraft n'existe pas.");
    if (e instanceof MojangUnavailableError) {
      throw new Error("Impossible de vérifier le pseudo (API Mojang).");
    }
    throw e;
  }
}

export const completeOnboarding = createServerFn({ method: "POST" })
  .inputValidator((input) => onboardingSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const mojang = await fetchMojang(data.igName);

    // S'assurer que la fiche existe
    const existing = await db
      .from("members")
      .select("discord_id")
      .eq("discord_id", user.discordId)
      .maybeSingle();
    if (!existing.data) {
      await db.from("members").insert({
        discord_id: user.discordId,
        discord_username: user.username,
        status: "active",
      });
    }

    const upd = await db
      .from("members")
      .update({ ig_name: mojang.name, mc_uuid: normalizeUuid(mojang.id) })
      .eq("discord_id", user.discordId);
    if (upd.error) throw new Error(upd.error.message);

    // Alts : on remplace (suppr + insert) pour éviter les doublons silencieux
    const alts = (data.alts ?? []).filter((a) => a.altName || a.altDiscordId);
    if (alts.length) {
      await db.from("member_alts").delete().eq("member_discord_id", user.discordId);
      await db.from("member_alts").insert(
        alts.map((a) => ({
          member_discord_id: user.discordId,
          alt_name: a.altName?.trim() || null,
          alt_discord_id: a.altDiscordId?.trim() || null,
        })),
      );
    }

    // Best-effort: track this player for HDV listings sync (don't fail onboarding)
    try {
      const normalizedUuid = normalizeUuid(mojang.id);
      const nowIso = new Date().toISOString();
      const { data: trackedExisting } = await db
        .from("paladium_tracked_players")
        .select("uuid")
        .eq("uuid", normalizedUuid)
        .maybeSingle();
      if (!trackedExisting) {
        await db.from("paladium_tracked_players").insert({
          uuid: normalizedUuid,
          username: mojang.name,
          search_count: 0,
          first_searched_at: nowIso,
          last_searched_at: nowIso,
        });
      } else {
        await db
          .from("paladium_tracked_players")
          .update({ username: mojang.name })
          .eq("uuid", normalizedUuid);
      }
    } catch {
      /* ignore — tracking is best-effort */
    }

    await logAction("onboarding_complete", user.discordId, {
      ig_name: mojang.name,
      alts: alts.length,
    });
    return { ok: true, igName: mojang.name, mcUuid: normalizeUuid(mojang.id) };
  });

/* ---------- Personnalisation du profil (bio + tags de rôle) ---------- */

const profileSchema = z.object({
  // Bornes larges côté schéma ; on trim/slice/filtre dans le handler (source de vérité serveur).
  bio: z
    .string()
    .max(MAX_BIO_LENGTH * 4)
    .optional()
    .default(""),
  roles: z.array(z.string().max(32)).max(50).optional().default([]),
});

/** Met à jour la bio et les tags de rôle du membre connecté. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => profileSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const bio = (data.bio ?? "").trim().slice(0, MAX_BIO_LENGTH);
    const roles = [...new Set((data.roles ?? []).filter((r) => ROLE_TAG_IDS.includes(r)))].slice(
      0,
      MAX_ROLE_TAGS,
    );

    const upd = await db
      .from("members")
      .update({ bio: bio || null, roles })
      .eq("discord_id", user.discordId);
    if (upd.error) throw new Error(upd.error.message);

    await logAction("profile_update", user.discordId, {
      roles: roles.length,
      bioLen: bio.length,
    });
    return { ok: true, bio: bio || null, roles };
  });

/* ---------- Sanctions & appeals (vue membre) ---------- */

export const listMyWarnings = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const { data: warnings, error } = await db
    .from("warnings")
    .select("*")
    .eq("member_discord_id", user.discordId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (warnings ?? []).map((w) => w.id);
  let appeals: Array<{
    id: string;
    warning_id: string;
    status: string;
    message: string;
    decision_note: string | null;
    created_at: string;
    decided_at: string | null;
  }> = [];
  if (ids.length) {
    const { data: ap } = await db
      .from("warning_appeals")
      .select("id, warning_id, status, message, decision_note, created_at, decided_at")
      .in("warning_id", ids)
      .order("created_at", { ascending: false });
    appeals = ap ?? [];
  }
  const byWarning = new Map<string, (typeof appeals)[number]>();
  for (const a of appeals) {
    if (!byWarning.has(a.warning_id)) byWarning.set(a.warning_id, a);
  }
  return {
    warnings: (warnings ?? []).map((w) => ({ ...w, appeal: byWarning.get(w.id) ?? null })),
  };
});

export const submitWarningAppeal = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ warningId: z.string().uuid(), message: z.string().min(10).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { data: w, error: wErr } = await db
      .from("warnings")
      .select("id, member_discord_id, status, body, severity")
      .eq("id", data.warningId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!w) throw new Error("NOT_FOUND");
    if (w.member_discord_id !== user.discordId) throw new Error("FORBIDDEN");
    if (w.status !== "active") throw new Error("Cet avertissement ne peut plus être contesté");

    const { data: existing } = await db
      .from("warning_appeals")
      .select("id")
      .eq("warning_id", data.warningId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("Un appel est déjà en cours");

    const { error } = await db.from("warning_appeals").insert({
      warning_id: data.warningId,
      member_discord_id: user.discordId,
      message: data.message,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    await logAction("warning_appeal_submit", user.discordId, { warningId: data.warningId });

    const { logToDiscord, COLORS } = await import("@/lib/discord/log.server");
    void logToDiscord("site", {
      title: "📨 Nouvel appel d'avertissement",
      color: COLORS.warn,
      description: w.body.slice(0, 200),
      fields: [
        { name: "Membre", value: user.username, inline: true },
        { name: "Gravité", value: w.severity ?? "minor", inline: true },
      ],
    });
    return { ok: true };
  });

/* ---------- Période d'essai : onboarding tasks (vue membre) ---------- */

export const listMyOnboardingTasks = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const { data, error } = await db
    .from("onboarding_tasks")
    .select("*")
    .eq("member_discord_id", user.discordId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return { tasks: data ?? [] };
});

export const toggleMyOnboardingTask = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { data: row, error: fetchErr } = await db
      .from("onboarding_tasks")
      .select("id, member_discord_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("NOT_FOUND");
    if (row.member_discord_id !== user.discordId) throw new Error("FORBIDDEN");
    const { error } = await db
      .from("onboarding_tasks")
      .update({ done: data.done, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Progression de grade (vue membre) ---------- */

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Calcule la progression du membre connecté vers son prochain grade. */
export const getMyRankupProgress = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();

  const [memberRes, thrRes] = await Promise.all([
    db
      .from("members")
      .select(
        "current_grade, astik_points, arrival_date, last_rankup, messages_7d, voice_7d_seconds",
      )
      .eq("discord_id", user.discordId)
      .maybeSingle(),
    db
      .from("grade_thresholds")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true }),
  ]);
  if (memberRes.error) throw new Error(memberRes.error.message);

  const m = memberRes.data;
  const thresholds = thrRes.data ?? [];
  if (!m || thresholds.length === 0) {
    return { configured: false as const };
  }

  const current = thresholds.find((t) => t.grade_label === m.current_grade) ?? null;
  const currentOrder = current?.display_order ?? -1;
  const next = thresholds.find((t) => t.display_order > currentOrder) ?? null;

  if (!next) {
    return {
      configured: true as const,
      isMax: true as const,
      currentGrade: m.current_grade ?? null,
    };
  }

  const daysInFaction = daysSince(m.arrival_date) ?? 0;
  const daysSinceRankup = daysSince(m.last_rankup ?? m.arrival_date) ?? daysInFaction;
  const voiceHours = Math.round((m.voice_7d_seconds ?? 0) / 360) / 10;
  const needVoiceHours = Math.round((next.min_voice_7d_seconds ?? 0) / 360) / 10;

  const req = {
    points: { have: m.astik_points ?? 0, need: next.min_points ?? 0 },
    daysInFaction: { have: daysInFaction, need: next.min_days_in_faction ?? 0 },
    messages7d: { have: m.messages_7d ?? 0, need: next.min_messages_7d ?? 0 },
    voice7dHours: { have: voiceHours, need: needVoiceHours },
    daysSinceRankup: { have: daysSinceRankup, need: next.min_days_since_rankup ?? 0 },
  };
  const allMet = Object.values(req).every((r) => r.have >= r.need);

  return {
    configured: true as const,
    isMax: false as const,
    currentGrade: m.current_grade ?? null,
    nextGrade: next.grade_label,
    requirements: req,
    allMet,
  };
});

/* ---------- Mes recrues (vue membre) ---------- */

/** Liste les membres recrutés par le membre connecté (filtrés vrais membres faction). */
export const listMyRecruits = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const { data, error } = await db
    .from("members")
    .select("discord_id, ig_name, discord_username, current_grade, arrival_date, mc_uuid, status")
    .eq("recruiter_discord_id", user.discordId)
    .order("arrival_date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return { recruits: filterFactionMembers(data) };
});

/* ---------- Mon salaire (vue membre) ---------- */

/** Salaire hebdo (selon grade) + historique des versements du membre connecté. */
export const getMySalary = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const memberRes = await db
    .from("members")
    .select("current_grade, voice_7d_seconds")
    .eq("discord_id", user.discordId)
    .maybeSingle();
  if (memberRes.error) throw new Error(memberRes.error.message);
  const grade = memberRes.data?.current_grade ?? null;

  let weeklyPoints: number | null = null;
  let minActivitySeconds = 0;
  if (grade) {
    const g = await db
      .from("salary_grades")
      .select("weekly_points, min_activity_seconds, active")
      .eq("grade_label", grade)
      .eq("active", true)
      .maybeSingle();
    if (g.data) {
      weeklyPoints = g.data.weekly_points;
      minActivitySeconds = g.data.min_activity_seconds ?? 0;
    }
  }

  const histRes = await db
    .from("points_ledger")
    .select("id, amount, reason, total_after, created_at")
    .eq("member_discord_id", user.discordId)
    .eq("action_type", "salary")
    .order("created_at", { ascending: false })
    .limit(12);

  const activitySeconds = memberRes.data?.voice_7d_seconds ?? 0;
  return {
    grade,
    weeklyPoints,
    minActivitySeconds,
    activitySeconds,
    eligible: activitySeconds >= minActivitySeconds,
    history: histRes.data ?? [],
  };
});

/* ---------- Mes absences (vue membre) ---------- */

/** Liste les absences du membre connecté. */
export const listMyAbsences = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const { data, error } = await db
    .from("absences")
    .select("id, type, reason, starts_on, ends_on, created_at")
    .eq("member_discord_id", user.discordId)
    .order("starts_on", { ascending: false });
  if (error) throw new Error(error.message);
  return { absences: data ?? [] };
});

/* ---------- Mes objectifs (vue membre) ---------- */

/** Objectifs de faction actifs + contribution cumulée du membre connecté. */
export const getMyObjectives = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const [objRes, contribRes] = await Promise.all([
    db
      .from("objectives")
      .select("id, title, description, target_value, unit, current_value, reward_points, done")
      .eq("done", false)
      .order("display_order", { ascending: true }),
    db
      .from("objective_contributions")
      .select("objective_id, amount")
      .eq("member_discord_id", user.discordId),
  ]);
  if (objRes.error) throw new Error(objRes.error.message);

  const myContributions: Record<string, number> = {};
  for (const c of contribRes.data ?? []) {
    myContributions[c.objective_id] = (myContributions[c.objective_id] ?? 0) + (c.amount ?? 0);
  }
  return { objectives: objRes.data ?? [], myContributions };
});

/* ---------- Heatmap d'activité (vue membre) ---------- */

/** Connexions par jour du membre connecté, sur N jours (heatmap façon GitHub). */
export const getMyActivityHeatmap = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ days: z.number().int().min(7).max(366).default(182) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const { data: rows, error } = await db
      .from("logs")
      .select("created_at")
      .eq("action", "login")
      .eq("actor_discord_id", user.discordId)
      .gte("created_at", since);
    if (error) throw new Error(error.message);

    const byDay: Record<string, number> = {};
    for (const r of rows ?? []) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const heatmap: Array<{ day: string; count: number }> = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      heatmap.push({ day, count: byDay[day] ?? 0 });
    }
    const activeDays = Object.keys(byDay).length;
    return { heatmap, activeDays };
  });

/* ---------- Récap mensuel (vue membre) ---------- */

/** « Ton mois en chiffres » : points gagnés, dons, activité 7j (sur N derniers jours). */
export const getMyMonthlyRecap = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ days: z.number().int().min(7).max(366).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [ledgerRes, memberRes] = await Promise.all([
      db
        .from("points_ledger")
        .select("action_type, amount, created_at")
        .eq("member_discord_id", user.discordId)
        .gte("created_at", since),
      db
        .from("members")
        .select("messages_7d, voice_7d_seconds")
        .eq("discord_id", user.discordId)
        .maybeSingle(),
    ]);
    if (ledgerRes.error) throw new Error(ledgerRes.error.message);

    let pointsGained = 0;
    let pointsLost = 0;
    let donationPoints = 0;
    let donationCount = 0;
    for (const row of ledgerRes.data ?? []) {
      const amt = row.amount ?? 0;
      if (amt >= 0) pointsGained += amt;
      else pointsLost += amt;
      if (row.action_type === "donation") {
        donationPoints += amt;
        donationCount += 1;
      }
    }

    return {
      days: data.days,
      pointsGained,
      pointsLost,
      donationPoints,
      donationCount,
      messages7d: memberRes.data?.messages_7d ?? 0,
      voice7dSeconds: memberRes.data?.voice_7d_seconds ?? 0,
    };
  });

/* ---------- Bento « La faction en chiffres » (vue membre faction) ---------- */

/**
 * Agrégats faction visibles par tout membre faction : effectif, candidatures,
 * richesse totale (argent en jeu via mc_player_stats + ventes en cours), ventes
 * réalisées sur 30 j (série journalière pour le graphe) et AstikPoints cumulés.
 * Réservé aux vrais membres faction (isFactionMember) — sinon { eligible:false }.
 */
export const getFactionBento = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();

  const meRow = await db
    .from("members")
    .select("ig_name, current_grade, arrival_date, mc_uuid")
    .eq("discord_id", user.discordId)
    .maybeSingle();
  if (!meRow.data || !isFactionMember(meRow.data)) {
    return { eligible: false as const };
  }

  const since30Iso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since30Date = since30Iso.slice(0, 10);

  const [membersRes, pendingAppsRes, apps30Res] = await Promise.all([
    db
      .from("members")
      .select("ig_name, current_grade, arrival_date, mc_uuid, astik_points")
      .eq("status", "active"),
    db.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db
      .from("applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30Iso),
  ]);

  const faction = filterFactionMembers(membersRes.data ?? []);
  const memberCount = faction.length;
  const totalAstikPoints = faction.reduce(
    (acc, m) => acc + ((m as { astik_points?: number }).astik_points ?? 0),
    0,
  );
  const arrivals30d = faction.filter((m) => m.arrival_date && m.arrival_date >= since30Date).length;
  const uuids = faction.map((m) => m.mc_uuid).filter((u): u is string => Boolean(u));

  // Argent en jeu : dernier snapshot par joueur (mc_player_stats).
  let totalIngameMoney = 0;
  let moneyTracked = 0;
  if (uuids.length) {
    const { data: stats } = await db
      .from("mc_player_stats")
      .select("mc_uuid, money, snapshot_at")
      .in("mc_uuid", uuids)
      .order("snapshot_at", { ascending: false })
      .limit(20000);
    const seen = new Set<string>();
    for (const s of (stats ?? []) as Array<{ mc_uuid: string; money: number | null }>) {
      if (seen.has(s.mc_uuid)) continue; // on garde le snapshot le plus récent
      seen.add(s.mc_uuid);
      if (s.money != null) {
        totalIngameMoney += Number(s.money);
        moneyTracked += 1;
      }
    }
  }

  // Ventes : listings HDV des membres sur 30 j (réalisées + en cours).
  let soldValue = 0;
  let listedValue = 0;
  const dayTotals = new Map<string, number>();
  if (uuids.length) {
    const { data: listings } = await db
      .from("paladium_player_listings_history")
      .select("quantity, price, sold_at, first_seen_at")
      .in("player_uuid", uuids)
      .gte("first_seen_at", since30Iso)
      .limit(50000);
    for (const l of (listings ?? []) as Array<{
      quantity: number | null;
      price: number | null;
      sold_at: string | null;
    }>) {
      const value = Number(l.price ?? 0) * Number(l.quantity ?? 0);
      if (l.sold_at) {
        soldValue += value;
        const day = String(l.sold_at).slice(0, 10);
        dayTotals.set(day, (dayTotals.get(day) ?? 0) + value);
      } else {
        listedValue += value;
      }
    }
  }

  const salesSeries: Array<{ day: string; value: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    salesSeries.push({ day, value: Math.round(dayTotals.get(day) ?? 0) });
  }

  return {
    eligible: true as const,
    memberCount,
    arrivals30d,
    pendingApplications: pendingAppsRes.count ?? 0,
    applications30d: apps30Res.count ?? 0,
    totalAstikPoints,
    totalIngameMoney: Math.round(totalIngameMoney),
    moneyTracked,
    // Richesse totale = argent en jeu + valeur des ventes encore en ligne.
    totalWealth: Math.round(totalIngameMoney + listedValue),
    sales: {
      soldValue: Math.round(soldValue),
      listedValue: Math.round(listedValue),
      series: salesSeries,
    },
  };
});
