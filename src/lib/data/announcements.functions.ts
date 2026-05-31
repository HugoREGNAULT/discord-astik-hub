/**
 * Annonces internes avec accusé de lecture (require_ack) et cross-post Discord.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { isFactionMember, canAccess } from "@/lib/auth/permissions";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

const idSchema = z.object({ id: z.string().uuid() });

const upsertSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(5000),
  pinned: z.boolean().optional().default(false),
  requireAck: z.boolean().optional().default(true),
});

function truncate(s: string, n = 500) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function broadcast(title: string, body: string, by: string) {
  await logToDiscord("site", {
    title: `📣 ${title}`,
    color: COLORS.info,
    description: truncate(body, 1500),
    fields: [{ name: "Par", value: by, inline: true }],
  });
}

export const listAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) throw new Error("FORBIDDEN");
  const canEdit = canAccess(user, "members.edit");

  const { data: anns, error } = await db
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const ids = (anns ?? []).map((a) => a.id);
  if (ids.length === 0) return { announcements: [] as Array<typeof anns[number] & { readByMe: boolean; readsCount: number | null }> };

  const { data: myReads } = await db
    .from("announcement_reads")
    .select("announcement_id")
    .eq("member_discord_id", user.discordId)
    .in("announcement_id", ids);
  const readSet = new Set((myReads ?? []).map((r) => r.announcement_id));

  let countsByAnn = new Map<string, number>();
  if (canEdit) {
    const { data: allReads } = await db
      .from("announcement_reads")
      .select("announcement_id")
      .in("announcement_id", ids);
    for (const r of allReads ?? []) {
      countsByAnn.set(r.announcement_id, (countsByAnn.get(r.announcement_id) ?? 0) + 1);
    }
  }

  return {
    announcements: (anns ?? []).map((a) => ({
      ...a,
      readByMe: readSet.has(a.id),
      readsCount: canEdit ? countsByAnn.get(a.id) ?? 0 : null,
    })),
  };
});

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: row, error } = await db
      .from("announcements")
      .insert({
        title: data.title,
        body: data.body,
        pinned: data.pinned ?? false,
        require_ack: data.requireAck ?? true,
        created_by_discord_id: user.discordId,
        created_by_username: user.username,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    await logAction("announcement_create", user.discordId, { id: row.id, title: row.title });
    await broadcast(row.title, row.body, user.username);
    return { id: row.id };
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("announcements")
      .update({
        title: data.title,
        body: data.body,
        pinned: data.pinned ?? false,
        require_ack: data.requireAck ?? true,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("announcement_update", user.discordId, { id: data.id });
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("announcement_delete", user.discordId, { id: data.id });
    return { ok: true };
  });

export const toggleAnnouncementPinned = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("announcements")
      .update({ pinned: data.pinned })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("announcement_pin", user.discordId, { id: data.id, pinned: data.pinned });
    return { ok: true };
  });

export const acknowledgeAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");
    const { error } = await db
      .from("announcement_reads")
      .upsert(
        {
          announcement_id: data.id,
          member_discord_id: user.discordId,
          read_at: new Date().toISOString(),
        },
        { onConflict: "announcement_id,member_discord_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnnouncementReaders = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => idSchema.parse(input))
  .handler(async ({ data }) => {
    await requirePermission("members.edit");

    const [{ data: reads }, { data: members }] = await Promise.all([
      db
        .from("announcement_reads")
        .select("member_discord_id, read_at")
        .eq("announcement_id", data.id)
        .order("read_at", { ascending: true }),
      db
        .from("members")
        .select("discord_id, discord_username, avatar_url")
        .eq("status", "active"),
    ]);

    const readMap = new Map((reads ?? []).map((r) => [r.member_discord_id, r.read_at]));
    const readers: Array<{ discord_id: string; username: string | null; avatar_url: string | null; read_at: string }> = [];
    const unread: Array<{ discord_id: string; username: string | null; avatar_url: string | null }> = [];

    for (const m of members ?? []) {
      if (readMap.has(m.discord_id)) {
        readers.push({
          discord_id: m.discord_id,
          username: m.discord_username,
          avatar_url: m.avatar_url,
          read_at: readMap.get(m.discord_id)!,
        });
      } else {
        unread.push({
          discord_id: m.discord_id,
          username: m.discord_username,
          avatar_url: m.avatar_url,
        });
      }
    }
    return { readers, unread, total: (members ?? []).length };
  });

export const getUnreadAnnouncementsCount = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) return { count: 0 };
  const { data: anns } = await db
    .from("announcements")
    .select("id")
    .eq("require_ack", true);
  const ids = (anns ?? []).map((a) => a.id);
  if (ids.length === 0) return { count: 0 };
  const { data: reads } = await db
    .from("announcement_reads")
    .select("announcement_id")
    .eq("member_discord_id", user.discordId)
    .in("announcement_id", ids);
  const readSet = new Set((reads ?? []).map((r) => r.announcement_id));
  return { count: ids.filter((id) => !readSet.has(id)).length };
});
