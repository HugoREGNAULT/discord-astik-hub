/**
 * Gamification server functions (XP, level, streak, badges).
 * Lecture seule côté client : tout est calculé serveur via recompute_member_xp().
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission } from "@/lib/auth/require.server";

type Badge = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  criteria: { type?: string; gte?: number } | null;
};

type MemberXp = {
  discord_id: string;
  xp: number;
  level: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string | null;
};

export type GamificationPayload = {
  xp: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveDate: string | null;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  earnedBadges: Array<Badge & { awarded_at: string }>;
  lockedBadges: Badge[];
};

// Inverse de level_for_xp: level = floor(sqrt(xp/100))+1
function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (level - 1) * 100;
}

async function buildPayload(discordId: string): Promise<GamificationPayload> {
  const [xpRes, allBadgesRes, earnedRes] = await Promise.all([
    db.from("member_xp").select("*").eq("discord_id", discordId).maybeSingle(),
    db.from("badges").select("*").order("code"),
    db
      .from("member_badges")
      .select("badge_id, awarded_at")
      .eq("member_discord_id", discordId),
  ]);

  const xpRow = (xpRes.data ?? {
    discord_id: discordId,
    xp: 0,
    level: 1,
    current_streak_days: 0,
    longest_streak_days: 0,
    last_active_date: null,
  }) as MemberXp;

  const allBadges = (allBadgesRes.data ?? []) as Badge[];
  const earnedMap = new Map<string, string>(
    (earnedRes.data ?? []).map((r: { badge_id: string; awarded_at: string }) => [
      r.badge_id,
      r.awarded_at,
    ]),
  );

  const earnedBadges = allBadges
    .filter((b) => earnedMap.has(b.id))
    .map((b) => ({ ...b, awarded_at: earnedMap.get(b.id)! }));
  const lockedBadges = allBadges.filter((b) => !earnedMap.has(b.id));

  const xpCur = xpForLevel(xpRow.level);
  const xpNext = xpForLevel(xpRow.level + 1);
  const span = Math.max(1, xpNext - xpCur);
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round(((xpRow.xp - xpCur) / span) * 100)),
  );

  return {
    xp: Number(xpRow.xp ?? 0),
    level: xpRow.level,
    currentStreakDays: xpRow.current_streak_days,
    longestStreakDays: xpRow.longest_streak_days,
    lastActiveDate: xpRow.last_active_date,
    xpForCurrentLevel: xpCur,
    xpForNextLevel: xpNext,
    progressPct,
    earnedBadges,
    lockedBadges,
  };
}

export const getMyGamification = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await requireSession();
    return buildPayload(user.discordId);
  },
);

export const getMemberGamification = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ discordId: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    return buildPayload(data.discordId);
  });
