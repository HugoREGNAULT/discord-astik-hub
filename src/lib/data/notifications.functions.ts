/**
 * Notifications persistées en table `notifications`.
 *
 * Le type `NotificationItem` est conservé pour rétro-compatibilité avec
 * NotificationBell.tsx (champ `kind` libre : on garde une string typée
 * au sens runtime, l'UI fallback gère les inconnus).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";

export type NotificationItem = {
  id: string;
  kind: "points" | "warning" | "application" | "donation" | string;
  title: string;
  detail?: string;
  href?: string;
  createdAt: string;
  readAt?: string | null;
};

export const getMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const { data, error } = await db
    .from("notifications")
    .select("id, kind, title, detail, href, read_at, created_at")
    .eq("recipient_discord_id", user.discordId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const items: NotificationItem[] = (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    detail: n.detail ?? undefined,
    href: n.href ?? undefined,
    createdAt: n.created_at,
    readAt: n.read_at,
  }));
  return { items };
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { error } = await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_discord_id", user.discordId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(
  async () => {
    const user = await requireSession();
    const { error } = await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_discord_id", user.discordId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
);
