import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";
import { isMemberStaff } from "@/lib/auth/permissions";
import type { MemberTimeline, TimelinePoint } from "./points-timeline.functions";

function buildTimeline(rows: { amount: number; created_at: string }[]): TimelinePoint[] {
  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.amount;
    return { date: r.created_at, cumulative };
  });
}

export type LeaderboardEntry = {
  rank: number;
  discord_id: string;
  ig_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  astik_points: number;
  rankChange: number | null;
};

export const getPointsLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();

  // 1. Membres actifs non-staff
  const { data: members, error: mErr } = await db
    .from("members")
    .select("discord_id, ig_name, discord_username, avatar_url, astik_points, roles")
    .eq("status", "active");
  if (mErr) throw new Error(mErr.message);

  const nonStaff = (members ?? []).filter((m) => !isMemberStaff(m.roles ?? []));
  const sorted = [...nonStaff].sort((a, b) => (b.astik_points ?? 0) - (a.astik_points ?? 0));

  // 2. Top 10 — timelines pour le graphique
  const top10 = sorted.slice(0, 10);
  const top10Ids = top10.map((m) => m.discord_id);

  const top10Timelines: MemberTimeline[] = [];
  if (top10Ids.length > 0) {
    const { data: ledger, error: lErr } = await db
      .from("points_ledger")
      .select("member_discord_id, amount, created_at")
      .in("member_discord_id", top10Ids)
      .order("created_at", { ascending: true });
    if (lErr) throw new Error(lErr.message);

    const byMember = new Map<string, { amount: number; created_at: string }[]>();
    for (const row of ledger ?? []) {
      const arr = byMember.get(row.member_discord_id) ?? [];
      arr.push({ amount: row.amount, created_at: row.created_at });
      byMember.set(row.member_discord_id, arr);
    }

    for (const m of top10) {
      top10Timelines.push({
        discord_id: m.discord_id,
        ig_name: m.ig_name ?? m.discord_username ?? m.discord_id,
        timeline: buildTimeline(byMember.get(m.discord_id) ?? []),
      });
    }
  }

  // 3. Snapshot J-7 pour évolution de rang
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const allIds = nonStaff.map((m) => m.discord_id);

  const oldRankMap = new Map<string, number>();
  if (allIds.length > 0) {
    const { data: oldLedger } = await db
      .from("points_ledger")
      .select("member_discord_id, total_after, created_at")
      .in("member_discord_id", allIds)
      .lt("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    // Dernier total_after connu avant J-7 par membre
    const oldTotalMap = new Map<string, number>();
    for (const row of oldLedger ?? []) {
      if (!oldTotalMap.has(row.member_discord_id)) {
        oldTotalMap.set(row.member_discord_id, row.total_after ?? 0);
      }
    }

    // Rang J-7 parmi les membres ayant un historique
    const withHistory = nonStaff.filter((m) => oldTotalMap.has(m.discord_id));
    const sortedOld = [...withHistory].sort(
      (a, b) => (oldTotalMap.get(b.discord_id) ?? 0) - (oldTotalMap.get(a.discord_id) ?? 0),
    );
    sortedOld.forEach((m, i) => oldRankMap.set(m.discord_id, i + 1));
  }

  // 4. Leaderboard final
  const leaderboard: LeaderboardEntry[] = sorted.map((m, i) => {
    const currentRank = i + 1;
    const oldRank = oldRankMap.get(m.discord_id) ?? null;
    const rankChange = oldRank !== null ? oldRank - currentRank : null;
    return {
      rank: currentRank,
      discord_id: m.discord_id,
      ig_name: m.ig_name ?? null,
      discord_username: m.discord_username ?? null,
      avatar_url: m.avatar_url ?? null,
      astik_points: m.astik_points ?? 0,
      rankChange,
    };
  });

  return { leaderboard, top10Timelines };
});
