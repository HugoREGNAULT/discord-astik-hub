import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchPaladium } from "./paladium.server";

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

  const java = r.java as AnyObj | undefined;
  const global = java?.global as AnyObj | undefined;
  if (global) {
    out.push({
      server_key: "java.global",
      server_label: "Java Global",
      online_players: num(global.online ?? global.playersOnline),
      max_players: num(global.max ?? global.maxPlayers),
      is_online: Boolean((typeof global.online === "number" ? global.online > 0 : false) || global.status === "online" || global.up),
    });
  }
  const factions = java?.factions as AnyObj | undefined;
  if (factions && typeof factions === "object") {
    for (const [key, val] of Object.entries(factions)) {
      if (!val || typeof val !== "object") continue;
      const v = val as AnyObj;
      out.push({
        server_key: `java.factions.${key}`,
        server_label: `Faction ${key}`,
        online_players: num(v.online ?? v.playersOnline),
        max_players: num(v.max ?? v.maxPlayers),
        is_online: Boolean(v.online != null || v.status === "online" || v.up),
      });
    }
  }
  const launcher = r.launcher as AnyObj | undefined;
  if (launcher) {
    out.push({
      server_key: "launcher",
      server_label: "Launcher",
      online_players: num(launcher.online ?? launcher.playersOnline),
      max_players: num(launcher.max ?? launcher.maxPlayers),
      is_online: Boolean(launcher.online != null || launcher.status === "online" || launcher.up),
    });
  }
  const anarchy = r.anarchy as AnyObj | undefined;
  if (anarchy) {
    out.push({
      server_key: "anarchy",
      server_label: "Anarchy",
      online_players: num(anarchy.online ?? anarchy.playersOnline),
      max_players: num(anarchy.max ?? anarchy.maxPlayers),
      is_online: Boolean(anarchy.online != null || anarchy.status === "online" || anarchy.up),
    });
  }
  return out;
}

export const snapshotServerStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await fetchPaladium("/v1/status");
  const rows = flattenStatus(data);
  if (rows.length === 0) return { inserted: 0 };

  const payload = rows.map((r) => ({ ...r, raw: data as unknown as never }));
  const { error } = await supabaseAdmin.from("paladium_server_status_history").insert(payload);
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
});

export const getStatusHistory = createServerFn({ method: "GET" }).handler(async () => {
  // last 7 days
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("paladium_server_status_history")
    .select("server_key, server_label, online_players, is_online, captured_at")
    .gte("captured_at", since)
    .order("captured_at", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Array<{
    server_key: string;
    server_label: string | null;
    online_players: number | null;
    is_online: boolean;
    captured_at: string;
  }> };
});

/* ============= Admin shop snapshot (daily) ============= */

export const snapshotAdminShop = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await fetchPaladium("/v1/paladium/shop/admin/items");
  let items: AnyObj[] = [];
  if (Array.isArray(data)) items = data as AnyObj[];
  else if (data && typeof data === "object") {
    const d = data as AnyObj;
    for (const k of ["items", "data", "shop"]) {
      const v = d[k];
      if (Array.isArray(v)) { items = v as AnyObj[]; break; }
    }
  }
  if (items.length === 0) return { inserted: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const rows = items
    .map((it) => {
      const name = (it.name ?? it.item ?? it.id) as string | undefined;
      if (!name) return null;
      const price = typeof it.price === "number" ? it.price : null;
      const pricePB = typeof it.pricePB === "number" ? it.pricePB : null;
      const category = (it.category ?? it.type ?? null) as string | null;
      return {
        item_name: name,
        category,
        price,
        price_pb: pricePB,
        raw: it as unknown as never,
        snapshot_date: today,
      };
    })
    .filter(Boolean) as Array<{
    item_name: string;
    category: string | null;
    price: number | null;
    price_pb: number | null;
    raw: object;
    snapshot_date: string;
  }>;

  const { error } = await supabaseAdmin
    .from("paladium_admin_shop_history")
    .upsert(rows, { onConflict: "item_name,snapshot_date" });
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
});

export const getAdminShopLatest = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("paladium_admin_shop_history")
    .select("item_name, category, price, price_pb, snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  // Dedup by item_name keeping most recent
  const seen = new Set<string>();
  const latest: typeof data = [];
  for (const r of data ?? []) {
    if (seen.has(r.item_name)) continue;
    seen.add(r.item_name);
    latest.push(r);
  }
  return { items: latest as Array<{
    item_name: string;
    category: string | null;
    price: number | null;
    price_pb: number | null;
    snapshot_date: string;
  }> };
});

export const getAdminShopHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { itemName: string }) => d)
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("paladium_admin_shop_history")
      .select("snapshot_date, price, price_pb")
      .eq("item_name", data.itemName)
      .order("snapshot_date", { ascending: true })
      .limit(365);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as Array<{
      snapshot_date: string;
      price: number | null;
      price_pb: number | null;
    }> };
  });
