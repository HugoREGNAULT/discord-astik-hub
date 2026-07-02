import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchPaladium } from "./paladium.server";
import { requireSession } from "@/lib/auth/require.server";

/* ============= Status snapshot (every 1min) ============= */

type AnyObj = Record<string, unknown>;

// Serveurs retirés : plus maintenus par l'API. Filtré à la fois côté requête
// (getStatusHistory) et côté page (tools.uptime.tsx) — source unique ici.
export const EXCLUDED_SERVER_KEYS = ["anarchy", "launcher"] as const;
export function isExcludedServerKey(key: string): boolean {
  return (
    (EXCLUDED_SERVER_KEYS as readonly string[]).includes(key) || key.toLowerCase().includes("event")
  );
}

// Vocabulaire observé sur /v1/status pour les serveurs faction :
// running | offline | starting | restart | stopping | whitelist | unknown.
// Seul "running" (et "online" pour java.global/launcher/anarchy, qui n'utilisent
// pas le même vocabulaire) compte comme UP — tout le reste, y compris
// "whitelist", est DOWN pour le graphe de disponibilité.
function isUp(s: unknown): boolean {
  if (typeof s !== "string") return false;
  const v = s.toLowerCase();
  return v === "online" || v === "running";
}

function statusText(s: unknown): string | null {
  return typeof s === "string" && s.length > 0 ? s : null;
}

function flattenStatus(raw: unknown): Array<{
  server_key: string;
  server_label: string | null;
  online_players: number | null;
  max_players: number | null;
  is_online: boolean;
  status: string | null;
}> {
  const out: Array<{
    server_key: string;
    server_label: string | null;
    online_players: number | null;
    max_players: number | null;
    is_online: boolean;
    status: string | null;
  }> = [];
  if (!raw || typeof raw !== "object") return out;
  const r = raw as AnyObj;

  function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
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
      status: statusText(global.status),
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
        status: statusText(status),
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
      status: statusText(launcher.status),
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
      status: statusText(anarchy.status),
    });
  }
  return out;
}

export const snapshotServerStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await fetchPaladium("/v1/status");
  const rows = flattenStatus(data);
  if (rows.length === 0) return { inserted: 0 };

  // Le payload complet /v1/status n'est gardé que sur la ligne java.global :
  // le dupliquer sur chaque ligne (une par serveur, à chaque relevé) est un
  // gaspillage de stockage inutile maintenant que `status` est une colonne
  // dédiée par serveur.
  const payload = rows.map((r) => ({
    ...r,
    raw: r.server_key === "java.global" ? (data as unknown) : null,
  }));

  const { error } = await supabaseAdmin
    .from("paladium_server_status_history")
    .insert(payload as any);

  if (error) throw new Error(error.message);
  return { inserted: rows.length };
});

type StatusRow = {
  server_key: string;
  server_label: string | null;
  online_players: number | null;
  is_online: boolean;
  captured_at: string;
};

function downsampleStatusRows(rows: StatusRow[], bucketMs: number): StatusRow[] {
  // Agrège chaque bucket de temps × server_key : DOWN si AU MOINS UN relevé du
  // bucket était DOWN (sinon une coupure plus courte que bucketMs deviendrait
  // invisible — c'était le bug précédent, qui gardait seulement le premier
  // relevé rencontré par bucket). online_players = moyenne des relevés du bucket.
  type Acc = {
    label: string | null;
    allOnline: boolean;
    sumPlayers: number;
    nPlayers: number;
    bucketStart: number;
  };
  const byKey = new Map<string, Map<number, Acc>>();
  for (const r of rows) {
    const t = new Date(r.captured_at).getTime();
    const bucketStart = Math.floor(t / bucketMs) * bucketMs;
    let buckets = byKey.get(r.server_key);
    if (!buckets) {
      buckets = new Map();
      byKey.set(r.server_key, buckets);
    }
    const acc = buckets.get(bucketStart);
    if (!acc) {
      buckets.set(bucketStart, {
        label: r.server_label,
        allOnline: r.is_online,
        sumPlayers: r.online_players ?? 0,
        nPlayers: r.online_players != null ? 1 : 0,
        bucketStart,
      });
    } else {
      acc.allOnline = acc.allOnline && r.is_online;
      if (r.online_players != null) {
        acc.sumPlayers += r.online_players;
        acc.nPlayers += 1;
      }
    }
  }

  const result: StatusRow[] = [];
  for (const [key, buckets] of byKey) {
    const ordered = [...buckets.values()].sort((a, b) => a.bucketStart - b.bucketStart);
    for (const acc of ordered) {
      result.push({
        server_key: key,
        server_label: acc.label,
        online_players: acc.nPlayers > 0 ? Math.round(acc.sumPlayers / acc.nPlayers) : null,
        is_online: acc.allOnline,
        captured_at: new Date(acc.bucketStart).toISOString(),
      });
    }
  }
  return result;
}

export const getStatusHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(d?.days ?? 7), 1), 30),
  }))
  .handler(async ({ data }) => {
    await requireSession();
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    // 1j  → 1 pt / 1min (résolution brute, cadence du cron)
    // 7j  → 1 pt / 10min
    // 30j → 1 pt / 1h
    const bucketMs = data.days <= 1 ? 0 : data.days <= 7 ? 10 * 60_000 : 60 * 60_000;

    // Plafond de lignes brutes avant downsampling. Au relevé/minute, une
    // fenêtre peut dépasser ce plafond si le nombre de serveurs faction est
    // très élevé — dans ce cas on garde volontairement les relevés les plus
    // RÉCENTS (tri desc + limit + reverse) plutôt que les plus anciens : le
    // bug précédent (tri asc + limit) coupait silencieusement "maintenant" et
    // gardait de vieilles données, ce qui produisait un graphe plat figé sur
    // un point ancien.
    const rawLimit = data.days <= 1 ? 60_000 : data.days <= 7 ? 250_000 : 400_000;

    const { data: rows, error } = await supabaseAdmin
      .from("paladium_server_status_history")
      .select("server_key, server_label, online_players, is_online, captured_at")
      .gte("captured_at", since)
      .not("server_key", "in", `(${EXCLUDED_SERVER_KEYS.join(",")})`)
      .not("server_key", "ilike", "%event%")
      .order("captured_at", { ascending: false })
      .limit(rawLimit);
    if (error) throw new Error(error.message);

    const allRows = ((rows ?? []) as StatusRow[]).slice().reverse();

    const sampled = bucketMs > 0 ? downsampleStatusRows(allRows, bucketMs) : allRows;

    return { rows: sampled };
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

/* ============= Player count history (for affluence page) ============= */

export type PlayerCountPoint = { timestamp: string; count: number };
export type HeatmapCell = { dow: number; hour: number; avg: number };

export const getPlayerCountHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(d?.days ?? 7), 1), 30),
  }))
  .handler(async ({ data }) => {
    await requireSession();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("paladium_server_status_history")
      .select("online_players, captured_at")
      .eq("server_key", "java.global")
      .not("online_players", "is", null)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(50_000);

    if (error) throw new Error(error.message);

    const allRows = (rows ?? []) as Array<{ online_players: number; captured_at: string }>;

    // Downsampling par bucket pour limiter les points
    // 1j → 15min (brut), 7j → 30min, 30j → 2h
    const bucketMs = data.days <= 1 ? 15 * 60_000 : data.days <= 7 ? 30 * 60_000 : 2 * 60 * 60_000;
    const bucketMap = new Map<number, { sum: number; n: number }>();
    for (const r of allRows) {
      const t = new Date(r.captured_at).getTime();
      const b = Math.floor(t / bucketMs) * bucketMs;
      const prev = bucketMap.get(b) ?? { sum: 0, n: 0 };
      bucketMap.set(b, { sum: prev.sum + r.online_players, n: prev.n + 1 });
    }
    const points: PlayerCountPoint[] = [...bucketMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, { sum, n }]) => ({
        timestamp: new Date(ts).toISOString(),
        count: Math.round(sum / n),
      }));

    // Heatmap : agrégation par (dow, hour) en UTC+2 (approximation Europe/Paris)
    const UTC_OFFSET_H = 2;
    const heatMap = new Map<string, { sum: number; n: number }>();
    for (const r of allRows) {
      const d = new Date(r.captured_at);
      const localHour = (d.getUTCHours() + UTC_OFFSET_H) % 24;
      // Recalcule le jour local si minuit UTC+offset bascule en lendemain
      const totalMinutes = d.getUTCHours() * 60 + d.getUTCMinutes() + UTC_OFFSET_H * 60;
      const dayOffset = Math.floor(totalMinutes / (24 * 60));
      const localDow = (d.getUTCDay() + dayOffset) % 7;
      const key = `${localDow}_${localHour}`;
      const prev = heatMap.get(key) ?? { sum: 0, n: 0 };
      heatMap.set(key, { sum: prev.sum + r.online_players, n: prev.n + 1 });
    }
    const heatmap: HeatmapCell[] = [...heatMap.entries()].map(([key, { sum, n }]) => {
      const [dow, hour] = key.split("_").map(Number);
      return { dow, hour, avg: Math.round(sum / n) };
    });

    return { points, heatmap };
  });

/* ============= Latest player count (for /me banner) ============= */

export const getLatestPlayerCount = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("paladium_server_status_history")
    .select("online_players, captured_at")
    .eq("server_key", "java.global")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    online: data?.online_players ?? null,
    capturedAt: data?.captured_at ?? null,
  };
});

/* ============= Faction wealth snapshot ============= */

const FACTION_NAME = "PunkAstik";

export const snapshotFactionWealth = createServerFn({ method: "POST" }).handler(async () => {
  // 1. Argent vault faction via API Paladium
  let factionMoney = 0;
  try {
    const { data: factionData } = await fetchPaladium(
      `/v1/paladium/faction/profile/${encodeURIComponent(FACTION_NAME)}`,
    );
    const d = factionData as Record<string, unknown> | null;
    const raw =
      typeof d?.money === "number"
        ? d.money
        : typeof d?.vault === "number"
          ? d.vault
          : typeof d?.gold === "number"
            ? d.gold
            : 0;
    factionMoney = Math.round(Number(raw) || 0);
  } catch {
    factionMoney = 0;
  }

  // 2. Argent membres en jeu (dernier snapshot par joueur dans mc_player_stats)
  let membersMoney = 0;
  {
    const { data: stats } = await supabaseAdmin
      .from("mc_player_stats")
      .select("mc_uuid, money, snapshot_at")
      .order("snapshot_at", { ascending: false })
      .limit(20000);
    const seen = new Set<string>();
    for (const s of (stats ?? []) as Array<{
      mc_uuid: string;
      money: number | null;
      snapshot_at: string;
    }>) {
      if (seen.has(s.mc_uuid)) continue;
      seen.add(s.mc_uuid);
      if (s.money != null) membersMoney += Number(s.money);
    }
    membersMoney = Math.round(membersMoney);
  }

  // 3. Ventes HDV en cours (non vendues, sur 30j)
  let listedValue = 0;
  {
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: listings } = await supabaseAdmin
      .from("paladium_player_listings_history")
      .select("quantity, price, sold_at, first_seen_at")
      .gte("first_seen_at", since30)
      .is("sold_at", null)
      .limit(50000);
    for (const l of (listings ?? []) as Array<{ quantity: number | null; price: number | null }>) {
      listedValue += Number(l.price ?? 0) * Number(l.quantity ?? 0);
    }
    listedValue = Math.round(listedValue);
  }

  const totalWealth = factionMoney + membersMoney + listedValue;

  const { error } = await supabaseAdmin.from("paladium_faction_wealth_history").insert({
    faction_name: FACTION_NAME,
    faction_money: factionMoney,
    members_money: membersMoney,
    listed_value: listedValue,
    total_wealth: totalWealth,
  } as never);

  if (error) throw new Error(error.message);

  // Rétention : garder 90 jours
  await supabaseAdmin
    .from("paladium_faction_wealth_history")
    .delete()
    .lt("captured_at", new Date(Date.now() - 90 * 86_400_000).toISOString());

  return { factionMoney, membersMoney, listedValue, totalWealth };
});

export const getFactionWealthHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(d?.days ?? 30), 1), 90),
  }))
  .handler(async ({ data }) => {
    await requireSession();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("paladium_faction_wealth_history")
      .select("captured_at, faction_money, members_money, listed_value, total_wealth")
      .eq("faction_name", FACTION_NAME)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as Array<{
        captured_at: string;
        faction_money: number;
        members_money: number;
        listed_value: number;
        total_wealth: number;
      }>,
    };
  });
