import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

/**
 * Tableau de bord staff : KPIs et activité récente, accessible à tout
 * staff faction / staff points (perm members.view).
 */
export const getStaffDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [
    pendingApps,
    activeDonations,
    activeMembers,
    formerMembers,
    inactiveMembers,
    recentWarnings,
    recentApps,
    recentDonations,
    topPoints7d,
    staffActivity,
    appsTimeline,
    appsTotals,
  ] = await Promise.all([
    db.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),

    db.from("donations").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("members").select("discord_id", { count: "exact", head: true }).eq("status", "active"),
    db.from("members").select("discord_id", { count: "exact", head: true }).eq("status", "former"),
    db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, avatar_url, current_grade, messages_7d, voice_7d_seconds",
      )
      .eq("status", "active")
      .eq("messages_7d", 0)
      .eq("voice_7d_seconds", 0)
      .order("ig_name", { ascending: true, nullsFirst: false })
      .limit(50),
    db
      .from("warnings")
      .select("id, member_discord_id, body, staff_username, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("applications")
      .select("id, discord_username, mc_name, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("donations")
      .select("id, member_discord_id, staff_username, total_final, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    db.from("points_ledger").select("member_discord_id, amount").gte("created_at", since7d),
    db
      .from("logs")
      .select("id, action, actor_discord_id, level, payload, created_at")
      .not("actor_discord_id", "is", null)
      .neq("action", "permission_denied")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(15),
    db
      .from("applications")
      .select("created_at, status, decided_at")
      .gte("created_at", since90d)
      .order("created_at", { ascending: true }),
    db.from("applications").select("status"),
  ]);

  // Aggregate top contributors over last 7 days
  const sums = new Map<string, number>();
  for (const row of topPoints7d.data ?? []) {
    const id = (row as any).member_discord_id as string;
    const amt = (row as any).amount as number;
    sums.set(id, (sums.get(id) ?? 0) + amt);
  }
  const topIds = Array.from(sums.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topContributors: Array<{
    discord_id: string;
    ig_name: string | null;
    discord_username: string | null;
    avatar_url: string | null;
    points: number;
  }> = [];
  if (topIds.length > 0) {
    const { data: members } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, avatar_url")
      .in(
        "discord_id",
        topIds.map(([id]) => id),
      );
    const byId = new Map((members ?? []).map((m: any) => [m.discord_id, m]));
    topContributors = topIds.map(([id, points]) => {
      const m: any = byId.get(id) ?? {};
      return {
        discord_id: id,
        ig_name: m.ig_name ?? null,
        discord_username: m.discord_username ?? null,
        avatar_url: m.avatar_url ?? null,
        points,
      };
    });
  }

  // Applications timeline: daily counts over the last 90 days
  const timelineMap = new Map<string, { created: number; accepted: number; rejected: number }>();
  // seed all days so the chart has a continuous x-axis
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    timelineMap.set(key, { created: 0, accepted: 0, rejected: 0 });
  }
  for (const row of appsTimeline.data ?? []) {
    const r = row as { created_at: string; status: string; decided_at: string | null };
    const cKey = r.created_at.slice(0, 10);
    const cBucket = timelineMap.get(cKey);
    if (cBucket) cBucket.created += 1;
    if (r.decided_at && (r.status === "accepted" || r.status === "rejected")) {
      const dKey = r.decided_at.slice(0, 10);
      const dBucket = timelineMap.get(dKey);
      if (dBucket) {
        if (r.status === "accepted") dBucket.accepted += 1;
        else dBucket.rejected += 1;
      }
    }
  }
  const applicationsTimeline = Array.from(timelineMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  // Applications totals (all-time)
  let totalApps = 0,
    totalAccepted = 0,
    totalRejected = 0;
  for (const row of appsTotals.data ?? []) {
    totalApps += 1;
    const s = (row as { status: string }).status;
    if (s === "accepted") totalAccepted += 1;
    else if (s === "rejected") totalRejected += 1;
  }
  const acceptanceRate =
    totalAccepted + totalRejected > 0
      ? Math.round((totalAccepted / (totalAccepted + totalRejected)) * 100)
      : 0;

  return {
    kpis: {
      activeMembers: activeMembers.count ?? 0,
      formerMembers: formerMembers.count ?? 0,
      pendingApplications: pendingApps.count ?? 0,
      activeDonations: activeDonations.count ?? 0,
      inactiveCount: (inactiveMembers.data ?? []).length,
    },
    inactiveMembers: inactiveMembers.data ?? [],
    recentWarnings: recentWarnings.data ?? [],
    recentApplications: recentApps.data ?? [],
    recentDonations: recentDonations.data ?? [],
    topContributors,
    staffActivity: staffActivity.data ?? [],
    applicationsTimeline,
    applicationsStats: {
      total: totalApps,
      accepted: totalAccepted,
      rejected: totalRejected,
      acceptanceRate,
    },
  };
});
