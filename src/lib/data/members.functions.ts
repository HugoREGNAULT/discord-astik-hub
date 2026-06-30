import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, requireSelfOrPermission, logAction } from "@/lib/auth/require.server";
import { canAccess } from "@/lib/auth/permissions";
import { filterFactionMembers, isFactionMember } from "@/lib/data/faction-members";
import type { Json } from "@/integrations/supabase/types";
import { fetchPaladium, dashUuid } from "@/lib/paladium/paladium.server";

/* ---------- Lecture ---------- */

export const listMembers = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { q?: string; status?: "active" | "former" | "away" | "all" } = {}) => input,
  )
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    let q = db.from("members").select("*").order("ig_name", { ascending: true, nullsFirst: false });
    if (!data.status || data.status === "active") q = q.eq("status", "active");
    else if (data.status === "former") q = q.eq("status", "former");
    else if (data.status === "away") q = q.eq("status", "away");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const needle = data.q?.trim().toLowerCase();
    // Exclure les rows synchronisés depuis le serveur public sans aucune donnée
    // faction (ni grade, ni pseudo IG, ni date d'arrivée, ni UUID MC).
    // Ce sont des membres Discord du serveur public, pas des membres de la faction.
    const factionOnly = filterFactionMembers(rows ?? []);
    const filtered = needle
      ? factionOnly.filter(
          (m) =>
            m.discord_id.includes(needle) ||
            (m.discord_username ?? "").toLowerCase().includes(needle) ||
            (m.ig_name ?? "").toLowerCase().includes(needle),
        )
      : factionOnly;
    return { members: filtered };
  });

export const getMemberDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { discordId: string }) =>
    z.object({ discordId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { user, isSelf } = await requireSelfOrPermission(data.discordId, "members.view");

    const canViewStaffData = canAccess(user, "members.view");

    const [member, alts, recent, notes, warnings, pointsLedger, donations] = await Promise.all([
      db.from("members").select("*").eq("discord_id", data.discordId).maybeSingle(),
      db.from("member_alts").select("*").eq("member_discord_id", data.discordId),
      db
        .from("points_ledger")
        .select("*")
        .eq("member_discord_id", data.discordId)
        .order("created_at", { ascending: false })
        .limit(3),
      canAccess(user, "notes.view")
        ? db
            .from("notes")
            .select("*")
            .eq("member_discord_id", data.discordId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[], error: null }),
      canAccess(user, "warnings.view")
        ? db
            .from("warnings")
            .select("*")
            .eq("member_discord_id", data.discordId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[], error: null }),
      canViewStaffData
        ? db
            .from("points_ledger")
            .select("*")
            .eq("member_discord_id", data.discordId)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] as never[], error: null }),
      canViewStaffData
        ? db
            .from("donations")
            .select(
              "id, status, total_brut, total_final, bonus_pct, staff_username, created_at, validated_at",
            )
            .eq("member_discord_id", data.discordId)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);
    if (member.error) throw new Error(member.error.message);
    if (member.data && !isSelf && !isFactionMember(member.data)) throw new Error("NOT_FOUND");

    // Staff activity on this member (logs whose payload.target === discordId)
    // logs.payload is jsonb (dynamic shape) — typed as Json to satisfy server-fn
    // serialization while staying explicit (no `any`); narrow at use site.
    type StaffActivityLog = {
      id: string;
      action: string;
      actor_discord_id: string | null;
      payload: Json | null;
      level: string;
      created_at: string;
    };
    let staffActivity: StaffActivityLog[] = [];
    if (canViewStaffData) {
      const { data: logs } = await db
        .from("logs")
        .select("id, action, actor_discord_id, payload, level, created_at")
        .contains("payload", { target: data.discordId })
        .order("created_at", { ascending: false })
        .limit(30);
      staffActivity = (logs ?? []) as StaffActivityLog[];
    }

    // Recruiter info
    let recruiterInfo: {
      discord_id: string;
      ig_name: string | null;
      discord_username: string | null;
    } | null = null;
    const recruiterId = member.data?.recruiter_discord_id;
    if (canViewStaffData && recruiterId) {
      const { data: r } = await db
        .from("members")
        .select("discord_id, ig_name, discord_username, current_grade, arrival_date, mc_uuid")
        .eq("discord_id", recruiterId)
        .maybeSingle();
      recruiterInfo =
        r && isFactionMember(r)
          ? { discord_id: r.discord_id, ig_name: r.ig_name, discord_username: r.discord_username }
          : null;
    }

    return {
      member: member.data,
      alts: alts.data ?? [],
      recentGains: recent.data ?? [],
      notes: notes.data ?? [],
      warnings: warnings.data ?? [],
      pointsLedger: pointsLedger.data ?? [],
      donations: donations.data ?? [],
      staffActivity,
      recruiter: recruiterInfo,
      canEdit: canAccess(user, "members.edit"),
      canManagePoints: canAccess(user, "points.manage"),
      canViewStaffData,
    };
  });
/* ---------- Pagination historique ---------- */

const pageSchema = z.object({ discordId: z.string().min(1), offset: z.number().int().min(0) });

export const getMemberPointsHistory = createServerFn({ method: "GET" })
  .inputValidator((input) => pageSchema.parse(input))
  .handler(async ({ data }) => {
    await requireSelfOrPermission(data.discordId, "members.view");
    const { data: rows, error } = await db
      .from("points_ledger")
      .select("*")
      .eq("member_discord_id", data.discordId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + 19);
    if (error) throw new Error(error.message);
    return { items: rows ?? [], hasMore: (rows ?? []).length === 20 };
  });

export const getMemberDonations = createServerFn({ method: "GET" })
  .inputValidator((input) => pageSchema.parse(input))
  .handler(async ({ data }) => {
    await requireSelfOrPermission(data.discordId, "members.view");
    const { data: rows, error } = await db
      .from("donations")
      .select(
        "id, status, total_brut, total_final, bonus_pct, staff_username, created_at, validated_at",
      )
      .eq("member_discord_id", data.discordId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + 19);
    if (error) throw new Error(error.message);
    return { items: rows ?? [], hasMore: (rows ?? []).length === 20 };
  });

/* ---------- Édition (staff faction) ---------- */

const memberPatch = z.object({
  discordId: z.string().min(1),
  patch: z.object({
    ig_name: z.string().max(64).nullable().optional(),
    discord_username: z.string().max(64).nullable().optional(),
    mc_uuid: z.string().max(64).nullable().optional(),
    arrival_date: z.string().nullable().optional(),
    recruiter_discord_id: z.string().max(32).nullable().optional(),
    last_rankup: z.string().nullable().optional(),
    current_grade: z.string().max(64).nullable().optional(),
    status: z.enum(["active", "former", "away", "trial"]).optional(),
    trial_until: z.string().nullable().optional(),
    mentor_discord_id: z.string().max(32).nullable().optional(),
  }),
});

export const updateMember = createServerFn({ method: "POST" })
  .inputValidator((input) => memberPatch.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("members").update(data.patch).eq("discord_id", data.discordId);
    if (error) throw new Error(error.message);
    await logAction("member_update", user.discordId, { target: data.discordId, patch: data.patch });
    return { ok: true };
  });

export const addAlt = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        altDiscordId: z.string().max(32).optional(),
        altName: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("member_alts").insert({
      member_discord_id: data.memberDiscordId,
      alt_discord_id: data.altDiscordId,
      alt_name: data.altName,
    });
    if (error) throw new Error(error.message);
    await logAction("alt_add", user.discordId, { ...data });
    return { ok: true };
  });

export const removeAlt = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("member_alts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("alt_remove", user.discordId, { id: data.id });
    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ memberDiscordId: z.string(), body: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("notes.write");
    const { error } = await db.from("notes").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await logAction("note_add", user.discordId, { target: data.memberDiscordId });
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("notes.write");
    const { data: existing, error: gErr } = await db
      .from("notes")
      .select("member_discord_id")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!existing) throw new Error("NOT_FOUND");
    const { error } = await db.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("note_delete", user.discordId, {
      target: existing.member_discord_id,
      id: data.id,
    });
    return { ok: true };
  });

const SEVERITY_POINTS: Record<string, number> = {
  verbal: 0,
  minor: 1,
  major: 3,
  severe: 5,
};

export const addWarning = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string(),
        body: z.string().min(1).max(2000),
        severity: z.enum(["verbal", "minor", "major", "severe"]).default("minor"),
        category: z.string().max(64).optional(),
        expiresInDays: z.number().int().positive().max(3650).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("warnings.write");
    const points = SEVERITY_POINTS[data.severity] ?? 1;
    const expires_at = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString()
      : null;
    const { error } = await db.from("warnings").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      body: data.body,
      severity: data.severity,
      category: data.category ?? null,
      points,
      expires_at,
      status: "active",
    });
    if (error) throw new Error(error.message);
    await logAction("warning_add", user.discordId, {
      target: data.memberDiscordId,
      severity: data.severity,
      category: data.category,
    });
    // Pas de DM au membre pour les avertissements (décision staff).
    // Récap dans le salon staff (corps tronqué pour éviter de divulguer du sensible)
    const { postNotify, COLORS } = await import("@/lib/discord/log.server");
    const { notifyChannels } = await import("@/lib/discord/notify-channels.server");
    const severityColor =
      data.severity === "severe" || data.severity === "major" ? COLORS.danger : COLORS.warn;
    void postNotify(notifyChannels.STAFF, {
      title: "⚠️ Nouvel avertissement",
      color: severityColor,
      description: `Membre <@${data.memberDiscordId}> — par **${user.username}**`,
      fields: [
        { name: "Gravité", value: data.severity, inline: true },
        { name: "Points", value: String(points), inline: true },
        ...(data.category ? [{ name: "Catégorie", value: data.category, inline: true }] : []),
        { name: "Extrait", value: data.body.slice(0, 120) + (data.body.length > 120 ? "…" : "") },
      ],
    });
    // Notif persistée — membre destinataire
    const { notify } = await import("@/lib/data/notify.server");
    void notify({
      recipientDiscordId: data.memberDiscordId,
      kind: "warning",
      title: `Nouvel avertissement (${data.severity})`,
      detail: data.body.slice(0, 200),
      href: "/me",
    });
    return { ok: true };
  });

export const revokeWarning = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("warnings.write");
    const { data: w, error: gErr } = await db
      .from("warnings")
      .select("member_discord_id, body")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!w) throw new Error("NOT_FOUND");
    const { error } = await db
      .from("warnings")
      .update({
        status: "revoked",
        revoked_by_discord_id: user.discordId,
        revoked_reason: data.reason,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("warning_revoke", user.discordId, { target: w.member_discord_id, id: data.id });
    // Pas de DM au membre lors de la révocation.
    return { ok: true };
  });

export const markMemberAway = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("members")
      .update({ status: "away" })
      .eq("discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);
    await db.from("notes").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      body: `Marqué en absence${data.reason ? ` — ${data.reason}` : ""}`,
    });
    await logAction("member_mark_away", user.discordId, {
      target: data.memberDiscordId,
      reason: data.reason,
    });
    return { ok: true };
  });

export const dmMember = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1).max(32),
        content: z.string().min(1).max(1800),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { sendDiscordDM } = await import("@/lib/discord/dm.server");
    const res = await sendDiscordDM(data.memberDiscordId, data.content);
    await logAction("member_dm", user.discordId, {
      target: data.memberDiscordId,
      ok: res.ok,
      error: res.error,
      length: data.content.length,
    });
    if (!res.ok) throw new Error(res.error ?? "Échec de l'envoi du DM");
    return { ok: true };
  });

export const resolveAndUpdateIgName = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        discordId: z.string().min(1),
        igName: z.string().min(1).max(64).trim(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");

    // 1. Resolve Minecraft username → UUID via Paladium API
    let dashedUuid: string;
    const { data: profile } = await fetchPaladium(
      `/v1/paladium/player/profile/${encodeURIComponent(data.igName)}`,
    );
    const p = profile as Record<string, unknown>;
    const rawUuid =
      (typeof p.uuid === "string" && p.uuid) ||
      (typeof p.id === "string" && p.id) ||
      (typeof p.playerId === "string" && p.playerId) ||
      "";
    if (!rawUuid) throw new Error("Joueur introuvable sur Paladium");
    dashedUuid = dashUuid(rawUuid);

    // 2. UPDATE members SET ig_name, mc_uuid, updated_at WHERE discord_id
    const { data: rows, error } = await db
      .from("members")
      .update({
        ig_name: data.igName,
        mc_uuid: dashedUuid,
        updated_at: new Date().toISOString(),
      })
      .eq("discord_id", data.discordId)
      .select("discord_id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Membre introuvable");

    // 3. Best-effort: update Paladium player cache
    try {
      const [profileResult, jobsResult] = await Promise.all([
        fetchPaladium(`/v1/paladium/player/profile/${dashedUuid}`),
        fetchPaladium(`/v1/paladium/player/profile/${dashedUuid}/jobs`),
      ]);
      await db.from("paladium_player_cache").upsert({
        mc_uuid: dashedUuid,
        profile_json: profileResult.data as Json,
        jobs_json: jobsResult.data as Json,
        fetched_at: new Date().toISOString(),
      });
    } catch {
      // best-effort — cache failure must not fail the function
    }

    // 4. Log action
    await logAction("member_ig_name_update", user.discordId, {
      target: data.discordId,
      ig_name: data.igName,
      mc_uuid: dashedUuid,
    });

    // 5. Return result
    return { ok: true, mc_uuid: dashedUuid, ig_name: data.igName };
  });
