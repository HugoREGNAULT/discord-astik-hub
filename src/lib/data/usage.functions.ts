/**
 * Tracking discret de l'usage du site (page views authentifiées).
 *
 * - `recordView` : appelée par le layout authentifié à chaque changement de route.
 * - `getUsageStats` : agrégats (staff seulement) — top pages, top users, courbe horaire.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission } from "@/lib/auth/require.server";

const MAX_PATH_LEN = 200;

function normalizePath(raw: string): string {
  let p = (raw || "/").split("?")[0].split("#")[0];
  if (p.length > MAX_PATH_LEN) p = p.slice(0, MAX_PATH_LEN);
  // Anonymise les segments dynamiques évidents (uuid / discord id / longs nombres)
  // pour avoir des regroupements stables.
  return p
    .split("/")
    .map((seg) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id";
      if (/^\d{15,}$/.test(seg)) return ":id";
      return seg;
    })
    .join("/");
}

export const recordView = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        path: z.string().min(1).max(MAX_PATH_LEN),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const path = normalizePath(data.path);
    // Fire-and-forget côté DB : on n'expose pas les erreurs au client pour ne pas polluer la nav.
    try {
      await db.from("usage_events").insert({
        actor_discord_id: user.discordId,
        path,
      });
    } catch {
      // ignore
    }
    return { ok: true as const };
  });

export interface UsageStats {
  totalViews: number;
  uniqueUsers: number;
  topPaths: Array<{ path: string; views: number; users: number }>;
  topUsers: Array<{
    discord_id: string;
    discord_username: string | null;
    ig_name: string | null;
    avatar_url: string | null;
    views: number;
  }>;
  daily: Array<{ day: string; views: number; users: number }>;
}

export const getUsageStats = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        days: z.number().int().min(1).max(90).default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    const since = new Date(Date.now() - data.days * 24 * 3600 * 1000);
    const sinceIso = since.toISOString();

    const { data: rows, error } = await db
      .from("usage_events")
      .select("actor_discord_id, path, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(50000);
    if (error) throw new Error(error.message);

    const events = rows ?? [];
    const totalViews = events.length;

    const userSet = new Set<string>();
    const pathMap = new Map<string, { views: number; users: Set<string> }>();
    const userMap = new Map<string, number>();
    const dayMap = new Map<string, { views: number; users: Set<string> }>();

    for (const e of events) {
      userSet.add(e.actor_discord_id);

      const p = pathMap.get(e.path) ?? { views: 0, users: new Set<string>() };
      p.views += 1;
      p.users.add(e.actor_discord_id);
      pathMap.set(e.path, p);

      userMap.set(e.actor_discord_id, (userMap.get(e.actor_discord_id) ?? 0) + 1);

      const day = String(e.created_at).slice(0, 10);
      const d = dayMap.get(day) ?? { views: 0, users: new Set<string>() };
      d.views += 1;
      d.users.add(e.actor_discord_id);
      dayMap.set(day, d);
    }

    const topPaths = Array.from(pathMap.entries())
      .map(([path, v]) => ({ path, views: v.views, users: v.users.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 30);

    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    let topUsers: UsageStats["topUsers"] = [];
    if (topUserIds.length > 0) {
      const ids = topUserIds.map(([id]) => id);
      const { data: members } = await db
        .from("members")
        .select("discord_id, discord_username, ig_name, avatar_url")
        .in("discord_id", ids);
      const byId = new Map((members ?? []).map((m) => [m.discord_id, m]));
      topUsers = topUserIds.map(([id, views]) => {
        const m = byId.get(id);
        return {
          discord_id: id,
          discord_username: m?.discord_username ?? null,
          ig_name: m?.ig_name ?? null,
          avatar_url: m?.avatar_url ?? null,
          views,
        };
      });
    }

    // Remplit chaque jour de la fenêtre (pour un graphe propre).
    const daily: UsageStats["daily"] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      daily.push({
        day: key,
        views: entry?.views ?? 0,
        users: entry?.users.size ?? 0,
      });
    }

    return {
      totalViews,
      uniqueUsers: userSet.size,
      topPaths,
      topUsers,
      daily,
    } satisfies UsageStats;
  });
