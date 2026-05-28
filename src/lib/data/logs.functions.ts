import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

export const listLogs = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        action: z.string().trim().max(64).optional(),
        actorDiscordId: z.string().trim().max(32).optional(),
        level: z.enum(["info", "warn", "error", "all"]).optional().default("all"),
        sinceDays: z.number().int().min(1).max(365).optional().default(30),
        limit: z.number().int().min(1).max(500).optional().default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission("admin.access");
    const since = new Date(Date.now() - data.sinceDays * 86_400_000).toISOString();
    let q = db
      .from("logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.level && data.level !== "all") q = q.eq("level", data.level);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.actorDiscordId) q = q.eq("actor_discord_id", data.actorDiscordId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });

export const listLogActions = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("admin.access");
  const { data } = await db
    .from("logs")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(1000);
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.action);
  return { actions: Array.from(set).sort() };
});
