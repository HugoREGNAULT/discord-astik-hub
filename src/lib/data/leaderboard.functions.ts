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

export const getLeaderboardHistory = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("profile.self");
  // 30 derniers jours de snapshots
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ data: snapshots, error }, { data: members, error: membersError }] = await Promise.all([
    db
      .from("leaderboard_snapshots")
      .select(
        "taken_at,discord_id,astik_points,voice_total_seconds,voice_7d_seconds,messages_total,messages_7d",
      )
      .gte("taken_at", since)
      // Les plus RÉCENTS d'abord : si le volume dépasse la limite, on tronque le
      // passé lointain, jamais le présent (sinon "dernière actualisation" gèle).
      .order("taken_at", { ascending: false })
      .limit(20000),
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
  // Remis en ordre chronologique (ascendant) pour le graphique et la baseline.
  const chrono = (snapshots ?? []).slice().reverse();
  return { snapshots: chrono.filter((snapshot) => allowedIds.has(snapshot.discord_id)) };
});
