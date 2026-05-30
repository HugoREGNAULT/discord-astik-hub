import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";

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

  // Ping Discord API
  let discordOk = false;
  let discordLatency = 0;
  try {
    const t0 = Date.now();
    const r = await fetch("https://discord.com/api/v10/gateway");
    discordLatency = Date.now() - t0;
    discordOk = r.ok;
  } catch {
    discordOk = false;
  }

  return {
    profilesCount: filterFactionMembers(membersRes.data ?? []).length,
    activeCarts: activeCarts.count ?? 0,
    recentLogs: recentLogs.data ?? [],
    recentErrors: recentErrors.data ?? [],
    lastRoleRefresh: lastRefresh.data?.[0]?.refreshed_at ?? null,
    discord: { ok: discordOk, latencyMs: discordLatency },
  };
});
