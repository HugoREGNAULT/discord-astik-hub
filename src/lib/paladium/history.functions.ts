import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchPaladium } from "./paladium.server";
import { requireSession } from "@/lib/auth/require.server";

/* ============= Status snapshot (every 15min) ============= */

type AnyObj = Record<string, unknown>;

function flattenStatus(raw: unknown): Array<{
  server_key: string;
  server_label: string | null;
  online_players: number | null;
  max_players: number | null;
  is_online: boolean;
}> {
  const out: Array<{
    server_key: string;
    server_label: string | null;
    online_players: number | null;
    max_players: number | null;
    is_online: boolean;
  }> = [];
  if (!raw || typeof raw !== "object") return out;
  const r = raw as AnyObj;

  function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  function isUp(s: unknown): boolean {
    if (typeof s !== "string") return false;
    const v = s.toLowerCase();
    return v === "online" || v === "running" || v === "whitelist";
  }

  const java = r.java as AnyObj | undefined;
  const global = java?.global as AnyObj | undefined;
  if (global) {
    out.push({
      server_key: "java.global",
      server_label: "Java Global",
      online_players: num(global.players ?? global.online ?? global.playersOnline),
      max_players: num(global.max ?? global.maxPlayers),
      is_online: isUp(global.status as string | undefined),
    });
  }
  const factions = java?.factions as AnyObj | undefined;
  if (factions && typeof factions === "object") {
    for (const [key, val] of Object.entries(factions)) {
      // API shape: { "Soleratl": "running", ... } — value is a status string,
      // not an object. We don't get per-faction player counts.
      const status = typeof val === "string" ? val : (val as AnyObj)?.status;
      const obj = typeof val === "object" && val ? (val as AnyObj) : null;
      out.push({
        server_key: `java.factions.${key}`,
        server_label: `Faction ${key}`,
        online_players: obj ? num(obj.players ?? obj.online) : null,
        max_players: obj ? num(obj.max ?? obj.maxPlayers) : null,
        is_online: isUp(status),
      });
    }
  }
  const launcher = r.launcher as AnyObj | undefined;
  if (launcher) {
    out.push({
      server_key: "launcher",
      server_label: "Launcher",
      online_players: null,
      max_players: null,
      is_online: isUp(launcher.status as string | undefined),
    });
  }
  const anarchy = r.anarchy as AnyObj | undefined;
  if (anarchy) {
    out.push({
      server_key: "anarchy",
      server_label: "Anarchy",
      online_players: num(anarchy.players ?? anarchy.online),
      max_players: num(anarchy.max ?? anarchy.maxPlayers),
      is_online: isUp(anarchy.status as string | undefined),
    });
  }
  return out;
}

export const snapshotServerStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await fetchPaladium("/v1/status");
  const rows = flattenStatus(data);
  if (rows.length === 0) return { inserted: 0 };

  const payload = rows.map((r) => ({ ...r, raw: data as unknown }));

  const { error } = await supabaseAdmin
    .from("paladium_server_status_history")
    .insert(payload as any);

  if (error) throw new Error(error.message);
  return { inserted: rows.length };
});

export const getStatusHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(d?.days ?? 7), 1), 30),
  }))
  .handler(async ({ data }) => {
    await requireSession();
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("paladium_server_status_history")
      .select("server_key, server_label, online_players, is_online, captured_at")
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(10000);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as Array<{
        server_key: string;
        server_label: string | null;
        online_players: number | null;
        is_online: boolean;
        captured_at: string;
      }>,
    };
  });

/* ============= Admin shop snapshot (every 5 min) ============= */

export const snapshotAdminShop = createServerFn({ method: "POST" }).handler(async () => {
  // Paginate through all admin shop items (API limit: 100)
  type AdminItem = {
    name: string;
    category?: string | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    canBuy?: boolean;
    canSell?: boolean;
  };
  const items: AdminItem[] = [];
  const limit = 100;
  let offset = 0;
  for (let page = 0; page < 50; page++) {
    const { data } = await fetchPaladium(
      `/v1/paladium/shop/admin/items?limit=${limit}&offset=${offset}`,
    );
    const d = data as { data?: AdminItem[]; totalCount?: number } | AdminItem[];
    const batch = Array.isArray(d) ? d : (d?.data ?? []);
    items.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  if (items.length === 0) return { inserted: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const rows = items
    .map((it) => {
      if (!it.name) return null;
      const buy = typeof it.buyPrice === "number" ? it.buyPrice : null;
      const sell = typeof it.sellPrice === "number" ? it.sellPrice : null;
      return {
        item_name: it.name,
        category: it.category ?? null,
        price: buy,
        price_pb: sell,
        raw: it as unknown as never,
        snapshot_date: today,
      };
    })
    .filter(Boolean);

  const { error } = await supabaseAdmin
    .from("paladium_admin_shop_history")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(rows as any);
  if (error) throw new Error(error.message);

  // Retention: keep last 30 days
  await supabaseAdmin
    .from("paladium_admin_shop_history")
    .delete()
    .lt("captured_at", new Date(Date.now() - 30 * 86400000).toISOString());

  return { inserted: rows.length };
});

export const getAdminShopLatest = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  // Take the most recent snapshot batch (last 10 min worth).
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("paladium_admin_shop_history")
    .select("item_name, category, price, price_pb, captured_at")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const latest: Array<{
    item_name: string;
    category: string | null;
    price: number | null;
    price_pb: number | null;
    captured_at: string;
  }> = [];
  for (const r of data ?? []) {
    if (seen.has(r.item_name)) continue;
    seen.add(r.item_name);
    latest.push(r);
  }
  return { items: latest };
});

export const getAdminShopHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { itemName: string }) => d)
  .handler(async ({ data }) => {
    await requireSession();
    const { data: rows, error } = await supabaseAdmin
      .from("paladium_admin_shop_history")
      .select("captured_at, price, price_pb")
      .eq("item_name", data.itemName)
      .order("captured_at", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as Array<{
        captured_at: string;
        price: number | null;
        price_pb: number | null;
      }>,
    };
  });

export const getAdminShopTopMovers = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  // Compare latest snapshot vs the oldest snapshot within the last 7 days.
  const sinceOld = new Date(Date.now() - 7 * 86400000).toISOString();
  const sinceLatest = new Date(Date.now() - 10 * 60_000).toISOString();

  const [{ data: latestRows, error: e1 }, { data: oldRows, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from("paladium_admin_shop_history")
      .select("item_name, price_pb, captured_at")
      .gte("captured_at", sinceLatest)
      .order("captured_at", { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from("paladium_admin_shop_history")
      .select("item_name, price_pb, captured_at")
      .gte("captured_at", sinceOld)
      .order("captured_at", { ascending: true })
      .limit(20000),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const latestMap = new Map<string, number>();
  for (const r of latestRows ?? []) {
    if (latestMap.has(r.item_name)) continue;
    if (typeof r.price_pb === "number" && r.price_pb > 0) latestMap.set(r.item_name, r.price_pb);
  }
  const oldMap = new Map<string, number>();
  for (const r of oldRows ?? []) {
    if (oldMap.has(r.item_name)) continue;
    if (typeof r.price_pb === "number" && r.price_pb > 0) oldMap.set(r.item_name, r.price_pb);
  }

  const movers: Array<{ item_name: string; current: number; previous: number; pct: number }> = [];
  for (const [name, current] of latestMap) {
    const previous = oldMap.get(name);
    if (typeof previous !== "number" || previous === current) continue;
    const pct = ((current - previous) / previous) * 100;
    movers.push({ item_name: name, current, previous, pct });
  }
  movers.sort((a, b) => b.pct - a.pct);
  const top = movers.slice(0, 3);
  const flop = movers.slice(-3).reverse();
  return { top, flop };
});

/* ============= Market HDV price history (hourly, 7 days) ============= */

export const snapshotMarketPrices = createServerFn({ method: "POST" }).handler(async () => {
  // Paginate through all items (limit 100). Same shape as the live page.
  type Page = {
    data: Array<{
      name: string;
      countListings?: number;
      quantityAvailable?: number;
      quantitySoldTotal?: number;
      priceAverage?: number;
    }>;
    totalCount?: number;
  };
  const fetchPage = async (offset: number, limit: number) => {
    const { data } = await fetchPaladium(
      `/v1/paladium/shop/market/items?limit=${limit}&offset=${offset}`,
    );
    return data as Page;
  };

  const first = await fetchPage(0, 100);
  const total = first.totalCount ?? first.data.length;
  const all = [...first.data];
  const pages = Math.ceil(total / 100);
  for (let i = 1; i < pages; i++) {
    const p = await fetchPage(i * 100, 100);
    all.push(...p.data);
  }

  if (all.length === 0) return { inserted: 0 };

  const rows = all
    .filter((it) => it.name && typeof it.priceAverage === "number")
    .map((it) => ({
      item_name: it.name,
      price_average: it.priceAverage ?? null,
      count_listings: it.countListings ?? null,
      quantity_available: it.quantityAvailable ?? null,
      quantity_sold_total: it.quantitySoldTotal ?? null,
    }));

  // Insert in chunks to stay under the Supabase payload size cap.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);

    const { error } = await supabaseAdmin
      .from("paladium_market_price_history")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(slice as any);
    if (error) throw new Error(error.message);
  }

  // Keep only the last 7 days.
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  await supabaseAdmin.from("paladium_market_price_history").delete().lt("captured_at", cutoff);

  return { inserted: rows.length };
});

export const getMarketPriceHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { itemName: string; rangeHours?: number }) => ({
    itemName: d.itemName,
    rangeHours: Math.min(Math.max(Number(d.rangeHours ?? 168), 1), 24 * 30),
  }))
  .handler(async ({ data }) => {
    await requireSession();
    const since = new Date(Date.now() - data.rangeHours * 3600_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("paladium_market_price_history")
      .select("captured_at, price_average, count_listings, quantity_available")
      .eq("item_name", data.itemName)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as Array<{
        captured_at: string;
        price_average: number | null;
        count_listings: number | null;
        quantity_available: number | null;
      }>,
    };
  });
