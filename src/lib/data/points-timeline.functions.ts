import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, requireSelfOrPermission } from "@/lib/auth/require.server";
import { isMemberStaff } from "@/lib/auth/permissions";

export type TimelinePoint = { date: string; cumulative: number };
export type MemberTimeline = {
  discord_id: string;
  ig_name: string | null;
  timeline: TimelinePoint[];
};

function buildTimeline(rows: { amount: number; created_at: string }[]): TimelinePoint[] {
  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.amount;
    return { date: r.created_at, cumulative };
  });
}

/** Évolution cumulée des points d'un membre — accessible par le membre lui-même ou staff points. */
export const getPointsTimeline = createServerFn({ method: "GET" })
  .inputValidator((input: { memberDiscordId: string }) =>
    z.object({ memberDiscordId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSelfOrPermission(data.memberDiscordId, "points.manage");
    const { data: rows, error } = await db
      .from("points_ledger")
      .select("amount, created_at")
      .eq("member_discord_id", data.memberDiscordId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { timeline: buildTimeline(rows ?? []) };
  });

/** Timelines de tous les membres non-staff — réservé au staff points pour la comparaison. */
export const getComparisonTimelines = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("points.manage");

  const { data: members, error: mErr } = await db
    .from("members")
    .select("discord_id, ig_name, discord_username, roles")
    .eq("status", "active");
  if (mErr) throw new Error(mErr.message);

  const nonStaff = (members ?? []).filter((m) => !isMemberStaff(m.roles ?? []));
  if (nonStaff.length === 0) return { timelines: [] };

  const { data: ledger, error: lErr } = await db
    .from("points_ledger")
    .select("member_discord_id, amount, created_at")
    .in(
      "member_discord_id",
      nonStaff.map((m) => m.discord_id),
    )
    .order("created_at", { ascending: true });
  if (lErr) throw new Error(lErr.message);

  const byMember = new Map<string, { amount: number; created_at: string }[]>();
  for (const row of ledger ?? []) {
    const arr = byMember.get(row.member_discord_id) ?? [];
    arr.push({ amount: row.amount, created_at: row.created_at });
    byMember.set(row.member_discord_id, arr);
  }

  const timelines: MemberTimeline[] = nonStaff.map((m) => ({
    discord_id: m.discord_id,
    ig_name: m.ig_name ?? m.discord_username ?? m.discord_id,
    timeline: buildTimeline(byMember.get(m.discord_id) ?? []),
  }));

  return { timelines };
});
