import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

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
      "discord_id, discord_username, ig_name, avatar_url, current_grade, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d",
    )
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return { entries: (data ?? []) as LeaderboardEntry[] };
});
