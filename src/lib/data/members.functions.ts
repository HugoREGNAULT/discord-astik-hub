import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, requireSession, logAction } from "@/lib/auth/require.server";
import { canAccess } from "@/lib/auth/permissions";
import { filterFactionMembers } from "@/lib/data/faction-members";

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
    const user = await requireSession();
    const isSelf = user.discordId === data.discordId;
    if (!isSelf && !canAccess(user, "members.view")) throw new Error("FORBIDDEN");

    const canViewStaffData = canAccess(user, "members.view");

    const [member, alts, recent, notes, warnings, pointsLedger, donations, recruiter] =
      await Promise.all([
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
        Promise.resolve(null),
      ]);
    if (member.error) throw new Error(member.error.message);

    // Staff activity on this member (logs whose payload.target === discordId)
    let staffActivity: any[] = [];
    if (canViewStaffData) {
      const { data: logs } = await db
        .from("logs")
        .select("id, action, actor_discord_id, payload, level, created_at")
        .contains("payload", { target: data.discordId })
        .order("created_at", { ascending: false })
        .limit(30);
      staffActivity = logs ?? [];
    }

    // Recruiter info
    let recruiterInfo: {
      discord_id: string;
      ig_name: string | null;
      discord_username: string | null;
    } | null = null;
    const recruiterId = (member.data as any)?.recruiter_discord_id;
    if (canViewStaffData && recruiterId) {
      const { data: r } = await db
        .from("members")
        .select("discord_id, ig_name, discord_username")
        .eq("discord_id", recruiterId)
        .maybeSingle();
      recruiterInfo = (r as any) ?? null;
    }
    void recruiter;

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
    const user = await requireSession();
    const isSelf = user.discordId === data.discordId;
    if (!isSelf && !canAccess(user, "members.view")) throw new Error("FORBIDDEN");
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
    const user = await requireSession();
    const isSelf = user.discordId === data.discordId;
    if (!isSelf && !canAccess(user, "members.view")) throw new Error("FORBIDDEN");
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
    status: z.enum(["active", "former", "away"]).optional(),
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

export const addWarning = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ memberDiscordId: z.string(), body: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("warnings.write");
    const { error } = await db.from("warnings").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await logAction("warning_add", user.discordId, { target: data.memberDiscordId });
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
