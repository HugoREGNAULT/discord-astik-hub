import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";
import { pingDiscord } from "@/lib/discord/api.server";

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("admin.access");
  const [membersRes, activeCarts, recentLogs, recentErrors, lastRefresh] = await Promise.all([
    db.from("members").select("discord_id, ig_name, current_grade, arrival_date, mc_uuid"),
    db.from("donations").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("logs").select("*").order("created_at", { ascending: false }).limit(20),
    db
      .from("logs")
      .select("*")
      .eq("level", "error")
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("discord_role_cache")
      .select("refreshed_at")
      .order("refreshed_at", { ascending: false })
      .limit(1),
  ]);

  // Ping Discord API (cache mémoire 30 s, sémaphore + retry)
  const ping = await pingDiscord();

  return {
    profilesCount: filterFactionMembers(membersRes.data ?? []).length,
    activeCarts: activeCarts.count ?? 0,
    recentLogs: recentLogs.data ?? [],
    recentErrors: recentErrors.data ?? [],
    lastRoleRefresh: lastRefresh.data?.[0]?.refreshed_at ?? null,
    discord: { ok: ping.ok, latencyMs: ping.latencyMs },
  };
});
