import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

const UUID_RE = /^[0-9a-fA-F-]{32,36}$/;

type Listing = {
  id: string;
  player_uuid: string;
  item_name: string;
  quantity: number;
  price: number;
  price_pb: number | null;
  first_seen_at: string;
  last_seen_at: string;
  sold_at: string | null;
};

export const getFactionSalesOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const { data: members, error: mErr } = await db
    .from("members")
    .select("discord_id, ig_name, discord_username, mc_uuid, avatar_url")
    .eq("status", "active")
    .not("mc_uuid", "is", null);
  if (mErr) throw new Error(mErr.message);
  const ms = (members ?? []) as Array<{
    discord_id: string;
    ig_name: string | null;
    discord_username: string | null;
    mc_uuid: string;
    avatar_url: string | null;
  }>;

  const uuids = ms.map((m) => m.mc_uuid).filter(Boolean);
  if (uuids.length === 0) {
    return { rows: [], topItems: [], series: [], totals: { soldValue: 0, listedValue: 0 } };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: listings, error: lErr } = await db
    .from("paladium_player_listings_history")
    .select("id, player_uuid, item_name, quantity, price, price_pb, first_seen_at, last_seen_at, sold_at")
    .in("player_uuid", uuids)
    .gte("first_seen_at", since)
    .limit(50000);
  if (lErr) throw new Error(lErr.message);
  const ls = (listings ?? []) as Listing[];

  const byUuid = new Map<string, typeof ms[number]>();
  for (const m of ms) byUuid.set(m.mc_uuid, m);

  const byMember = new Map<
    string,
    {
      discord_id: string;
      name: string;
      avatar_url: string | null;
      openCount: number;
      soldCount: number;
      listedValue: number;
      soldValue: number;
    }
  >();

  const itemTotals = new Map<string, { qty: number; value: number; count: number }>();
  const dayTotals = new Map<string, number>();

  for (const l of ls) {
    const m = byUuid.get(l.player_uuid);
    if (!m) continue;
    const key = m.discord_id;
    const row =
      byMember.get(key) ??
      {
        discord_id: m.discord_id,
        name: m.ig_name ?? m.discord_username ?? m.discord_id,
        avatar_url: m.avatar_url,
        openCount: 0,
        soldCount: 0,
        listedValue: 0,
        soldValue: 0,
      };
    const value = Number(l.price ?? 0) * Number(l.quantity ?? 0);
    if (l.sold_at) {
      row.soldCount += 1;
      row.soldValue += value;
      const day = l.sold_at.slice(0, 10);
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + value);
      const it = itemTotals.get(l.item_name) ?? { qty: 0, value: 0, count: 0 };
      it.qty += Number(l.quantity ?? 0);
      it.value += value;
      it.count += 1;
      itemTotals.set(l.item_name, it);
    } else {
      row.openCount += 1;
      row.listedValue += value;
    }
    byMember.set(key, row);
  }

  const rows = Array.from(byMember.values()).sort((a, b) => b.soldValue - a.soldValue);
  const topItems = Array.from(itemTotals.entries())
    .map(([item_name, v]) => ({ item_name, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);
  const series = Array.from(dayTotals.entries())
    .map(([day, value]) => ({ day, value }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const totals = rows.reduce(
    (acc, r) => ({
      soldValue: acc.soldValue + r.soldValue,
      listedValue: acc.listedValue + r.listedValue,
    }),
    { soldValue: 0, listedValue: 0 },
  );

  return { rows, topItems, series, totals };
});

export const getMemberSales = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ memberDiscordId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    const { data: m } = await db
      .from("members")
      .select("discord_id, mc_uuid, ig_name, discord_username")
      .eq("discord_id", data.memberDiscordId)
      .maybeSingle();
    const uuid = (m as any)?.mc_uuid as string | undefined;
    if (!uuid || !UUID_RE.test(uuid)) {
      return { member: m, open: [], sold: [] };
    }
    const { data: rows } = await db
      .from("paladium_player_listings_history")
      .select("*")
      .eq("player_uuid", uuid)
      .order("first_seen_at", { ascending: false })
      .limit(200);
    const all = (rows ?? []) as Listing[];
    return {
      member: m,
      open: all.filter((r) => !r.sold_at),
      sold: all.filter((r) => !!r.sold_at),
    };
  });
