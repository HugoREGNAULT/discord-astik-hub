import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";

export type LeaderboardMetric = "points" | "voice" | "messages";

export interface LeaderboardEntry {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  astik_points: number;
  voice_total_seconds: number;
  voice_7d_seconds: number;
  messages_total: number;
  messages_7d: number;
}

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  // Tout membre connecté peut voir le classement.
  await requirePermission("profile.self");
  const { data, error } = await db
    .from("members")
    .select(
      "discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d",
    )
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const entries = filterFactionMembers(data ?? []);
  return { entries: entries as LeaderboardEntry[] };
});

export interface LeaderboardHistoryPoint {
  taken_at: string;
  values: Record<string, number>; // discord_id -> value
}

type HistoryPeriod = "24h" | "7d" | "30d" | "all";
const HISTORY_PERIODS = new Set<HistoryPeriod>(["24h", "7d", "30d", "all"]);

export const getLeaderboardHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { period?: string } | undefined) => {
    const p = d?.period as HistoryPeriod | undefined;
    return { period: p && HISTORY_PERIODS.has(p) ? p : ("30d" as HistoryPeriod) };
  })
  .handler(async ({ data }: { data: { period: HistoryPeriod } }) => {
    await requirePermission("profile.self");
    // Lecture routée par tier (downsampling) : 24h -> fine, 7j -> rollup 2h,
    // 30j/all -> rollup 1j. Cf. migration 20260610134500_leaderboard_tiered_retention.sql.
    const [{ data: snapshots, error }, { data: members, error: membersError }] = await Promise.all([
      db.rpc("leaderboard_history", { p_period: data.period }),
      db
        .from("members")
        .select("discord_id, ig_name, current_grade, arrival_date, mc_uuid")
        .eq("status", "active"),
    ]);
    if (error) throw new Error(error.message);
    if (membersError) throw new Error(membersError.message);
    const allowedIds = new Set(
      filterFactionMembers(members ?? []).map((member: any) => member.discord_id),
    );
    // La RPC ordonne par (membre, bucket) : on retrie en ordre chronologique global
    // pour le graphique et la baseline.
    const chrono = (snapshots ?? [])
      .slice()
      .sort((a: any, b: any) => String(a.taken_at).localeCompare(String(b.taken_at)));
    return { snapshots: chrono.filter((snapshot: any) => allowedIds.has(snapshot.discord_id)) };
  });
