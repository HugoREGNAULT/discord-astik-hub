import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { sanitizePostgrestLike } from "@/lib/data/postgrest";

export const listLogs = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        action: z.string().trim().max(64).optional(),
        actorDiscordId: z.string().trim().max(32).optional(),
        memberQuery: z.string().trim().max(64).optional(),
        level: z.enum(["info", "warn", "error", "all"]).optional().default("all"),
        sinceDays: z.number().int().min(1).max(365).optional().default(30),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(5000).optional().default(500),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission("admin.access");
    let q = db.from("logs").select("*").order("created_at", { ascending: false }).limit(data.limit);

    if (data.dateFrom) q = q.gte("created_at", data.dateFrom);
    else {
      const since = new Date(Date.now() - data.sinceDays * 86_400_000).toISOString();
      q = q.gte("created_at", since);
    }
    if (data.dateTo) q = q.lte("created_at", data.dateTo);
    if (data.level && data.level !== "all") q = q.eq("level", data.level);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.actorDiscordId) q = q.eq("actor_discord_id", data.actorDiscordId);

    if (data.memberQuery) {
      const needle = data.memberQuery;
      const safeNeedle = sanitizePostgrestLike(needle);
      // Resolve usernames to discord ids
      const { data: members } = await db
        .from("members")
        .select("discord_id")
        .or(`discord_username.ilike.%${safeNeedle}%,ig_name.ilike.%${safeNeedle}%,discord_id.eq.${safeNeedle}`)
        .limit(50);
      const ids = (members ?? []).map((m) => m.discord_id).filter(Boolean);
      if (/^\d{5,}$/.test(needle)) ids.push(needle);
      // Only inject strictly numeric ids into the .or clause to prevent
      // PostgREST filter injection via actor_discord_id.in.(...) / payload eq.
      const uniq = Array.from(new Set(ids)).filter((id) => /^\d+$/.test(id));
      if (uniq.length === 0) return { logs: [] };
      const orClause = [
        `actor_discord_id.in.(${uniq.join(",")})`,
        ...uniq.map((id) => `payload->>member_discord_id.eq.${id}`),
      ].join(",");
      q = q.or(orClause);
    }

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
