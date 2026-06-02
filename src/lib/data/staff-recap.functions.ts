import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";

export type RecapPunkRow = {
  discord_id: string;
  name: string;
  avatar_url: string | null;
  current_grade: string | null;
  points: number;
  delta_7d: number;
};

export type RecapSalesRow = {
  discord_id: string;
  name: string;
  avatar_url: string | null;
  sold_value: number;
  sold_count: number;
};

export type RecapAbsentRow = {
  discord_id: string;
  name: string;
  avatar_url: string | null;
  type: string;
  reason: string | null;
  starts_on: string;
  ends_on: string;
};

export type StaffRecap = {
  punk: { top: RecapPunkRow[]; totalActive: number };
  sales: { top: RecapSalesRow[]; totalValue7d: number; sellersCount: number };
  absences: { count: number; rows: RecapAbsentRow[] };
};

export const getStaffRecap = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffRecap> => {
    await requirePermission("members.view");

    const since7dIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [membersRes, snapshotsRes, salesListingsRes, absencesRes] = await Promise.all([
      db
        .from("members")
        .select(
          "discord_id, ig_name, discord_username, avatar_url, current_grade, arrival_date, mc_uuid, astik_points",
        )
        .eq("status", "active"),
      db
        .from("leaderboard_snapshots")
        .select("discord_id, taken_at, astik_points")
        .gte("taken_at", since7dIso)
        .order("taken_at", { ascending: true })
        .limit(100_000),
      db
        .from("paladium_player_listings_history")
        .select("player_uuid, price, quantity, sold_at")
        .gte("sold_at", since7dIso)
        .limit(50_000),
      db
        .from("absences")
        .select("member_discord_id, type, reason, starts_on, ends_on")
        .lte("starts_on", today)
        .gte("ends_on", today)
        .limit(500),
    ]);

    const members = filterFactionMembers(membersRes.data ?? []);
    const byId = new Map(members.map((m) => [m.discord_id, m] as const));
    const byUuid = new Map(
      members.filter((m) => m.mc_uuid).map((m) => [m.mc_uuid as string, m] as const),
    );

    // --- Punk: top 8 + 7d delta ---
    const earliest = new Map<string, number>();
    for (const row of (snapshotsRes.data ?? []) as Array<{
      discord_id: string;
      taken_at: string;
      astik_points: number;
    }>) {
      if (!earliest.has(row.discord_id)) {
        earliest.set(row.discord_id, Number(row.astik_points ?? 0));
      }
    }
    const punkRows: RecapPunkRow[] = members
      .map((m) => {
        const pts = Number(m.astik_points ?? 0);
        const prev = earliest.get(m.discord_id);
        return {
          discord_id: m.discord_id,
          name: m.ig_name ?? m.discord_username ?? m.discord_id,
          avatar_url: m.avatar_url ?? null,
          current_grade: m.current_grade ?? null,
          points: pts,
          delta_7d: prev !== undefined ? pts - prev : 0,
        };
      })
      .sort((a, b) => b.points - a.points);

    // --- Sales 7d ---
    const sellMap = new Map<string, RecapSalesRow>();
    let totalValue7d = 0;
    for (const l of (salesListingsRes.data ?? []) as Array<{
      player_uuid: string;
      price: number | null;
      quantity: number | null;
      sold_at: string | null;
    }>) {
      const m = byUuid.get(l.player_uuid);
      if (!m) continue;
      const value = Number(l.price ?? 0) * Number(l.quantity ?? 0);
      totalValue7d += value;
      const cur =
        sellMap.get(m.discord_id) ??
        {
          discord_id: m.discord_id,
          name: m.ig_name ?? m.discord_username ?? m.discord_id,
          avatar_url: m.avatar_url ?? null,
          sold_value: 0,
          sold_count: 0,
        };
      cur.sold_value += value;
      cur.sold_count += 1;
      sellMap.set(m.discord_id, cur);
    }
    const salesTop = Array.from(sellMap.values())
      .sort((a, b) => b.sold_value - a.sold_value)
      .slice(0, 8);

    // --- Absences (en cours) ---
    const absRows: RecapAbsentRow[] = [];
    for (const a of (absencesRes.data ?? []) as Array<{
      member_discord_id: string;
      type: string;
      reason: string | null;
      starts_on: string;
      ends_on: string;
    }>) {
      const m = byId.get(a.member_discord_id);
      if (!m) continue;
      absRows.push({
        discord_id: a.member_discord_id,
        name: m.ig_name ?? m.discord_username ?? a.member_discord_id,
        avatar_url: m.avatar_url ?? null,
        type: a.type,
        reason: a.reason,
        starts_on: a.starts_on,
        ends_on: a.ends_on,
      });
    }
    absRows.sort((a, b) => a.ends_on.localeCompare(b.ends_on));

    return {
      punk: { top: punkRows.slice(0, 8), totalActive: members.length },
      sales: { top: salesTop, totalValue7d, sellersCount: sellMap.size },
      absences: { count: absRows.length, rows: absRows.slice(0, 12) },
    };
  },
);
