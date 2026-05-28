import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, requireSession, logAction } from "@/lib/auth/require.server";
import { canAccess } from "@/lib/auth/permissions";

/* ---------- Lecture ---------- */

export const listMembers = createServerFn({ method: "GET" })
  .inputValidator((input: { q?: string; status?: "active" | "former" | "all" } = {}) => input)
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    let q = db.from("members").select("*").order("ig_name", { ascending: true, nullsFirst: false });
    if (!data.status || data.status === "active") q = q.eq("status", "active");
    else if (data.status === "former") q = q.eq("status", "former");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const needle = data.q?.trim().toLowerCase();
    const filtered = needle
      ? (rows ?? []).filter(
          (m) =>
            m.discord_id.includes(needle) ||
            (m.discord_username ?? "").toLowerCase().includes(needle) ||
            (m.ig_name ?? "").toLowerCase().includes(needle),
        )
      : (rows ?? []);
    return { members: filtered };
  });

export const getMemberDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { discordId: string }) => z.object({ discordId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const isSelf = user.discordId === data.discordId;
    if (!isSelf && !canAccess(user, "members.view")) throw new Error("FORBIDDEN");

    const [member, alts, recent, notes, warnings] = await Promise.all([
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
    ]);
    if (member.error) throw new Error(member.error.message);
    return {
      member: member.data,
      alts: alts.data ?? [],
      recentGains: recent.data ?? [],
      notes: notes.data ?? [],
      warnings: warnings.data ?? [],
      canEdit: canAccess(user, "members.edit"),
      canManagePoints: canAccess(user, "points.manage"),
    };
  });

/* ---------- Édition (staff faction) ---------- */

const memberPatch = z.object({
  discordId: z.string().min(1),
  patch: z.object({
    ig_name: z.string().max(64).nullable().optional(),
    arrival_date: z.string().nullable().optional(),
    recruiter_discord_id: z.string().max(32).nullable().optional(),
    last_rankup: z.string().nullable().optional(),
    current_grade: z.string().max(64).nullable().optional(),
    status: z.enum(["active", "former"]).optional(),
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
