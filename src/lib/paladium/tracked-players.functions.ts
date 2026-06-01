import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchPaladium } from "./paladium.server";
import { requireSession } from "@/lib/auth/require.server";

type ApiListing = {
  seller?: string;
  sellerName?: string;
  price?: number;
  pricePB?: number;
  quantity?: number;
  amount?: number;
  createdAt?: number;
  expireAt?: number;
  expiresAt?: number;
  _id?: string;
  id?: string;
};

type PlayerItemsResponse = {
  data?: Array<{
    name?: string;
    item?: string;
    listing?: ApiListing[];
    [k: string]: unknown;
  }>;
  totalCount?: number;
};

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function toIso(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  // Paladium returns seconds; if it looks like seconds, multiply.
  const ms = v < 1e12 ? v * 1000 : v;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function snapshotPlayerListings(uuid: string, username: string) {
  let payload: PlayerItemsResponse | null = null;
  try {
    const res = await fetchPaladium(
      `/v1/paladium/shop/market/players/${encodeURIComponent(uuid)}/items`,
    );
    payload = res.data as PlayerItemsResponse;
  } catch {
    return;
  }
  const items = payload?.data ?? [];
  const now = new Date().toISOString();

  const currentRows: Array<{
    player_uuid: string;
    item_name: string;
    quantity: number;
    price: number;
    price_pb: number | null;
    listed_at: string | null;
    expires_at: string | null;
    last_seen_at: string;
  }> = [];

  for (const entry of items) {
    const itemName = entry.name ?? entry.item ?? "unknown";
    for (const l of entry.listing ?? []) {
      const qty = Number(l.quantity ?? l.amount ?? 0);
      const price = Number(l.price ?? 0);
      if (!qty || !price) continue;
      currentRows.push({
        player_uuid: uuid,
        item_name: itemName,
        quantity: qty,
        price,
        price_pb: typeof l.pricePB === "number" ? l.pricePB : null,
        listed_at: toIso(l.createdAt),
        expires_at: toIso(l.expireAt ?? l.expiresAt),
        last_seen_at: now,
      });
    }
  }

  // Fetch existing open listings for this player
  const { data: existingRows } = await supabaseAdmin
    .from("paladium_player_listings_history")
    .select("id, item_name, price, quantity, listed_at, first_seen_at")
    .eq("player_uuid", uuid)
    .is("sold_at", null);

  const keyOf = (r: {
    item_name: string;
    price: number | string;
    quantity: number;
    listed_at: string | null;
    first_seen_at?: string;
  }) => `${r.item_name}|${Number(r.price)}|${r.quantity}|${r.listed_at ?? r.first_seen_at ?? ""}`;

  const existingMap = new Map<string, string>(); // key -> id
  for (const r of existingRows ?? []) {
    existingMap.set(
      keyOf({
        item_name: r.item_name,
        price: Number(r.price),
        quantity: r.quantity,
        listed_at: (r as { listed_at: string | null }).listed_at,
        first_seen_at: (r as { first_seen_at: string }).first_seen_at,
      }),
      r.id as string,
    );
  }

  const stillOpenIds = new Set<string>();
  const toInsert: typeof currentRows = [];

  for (const row of currentRows) {
    const k = `${row.item_name}|${row.price}|${row.quantity}|${row.listed_at ?? ""}`;
    const existingId = existingMap.get(k);
    if (existingId) {
      stillOpenIds.add(existingId);
    } else {
      toInsert.push(row);
    }
  }

  // Touch last_seen_at on still-open rows
  if (stillOpenIds.size > 0) {
    await supabaseAdmin
      .from("paladium_player_listings_history")
      .update({ last_seen_at: now })
      .in("id", Array.from(stillOpenIds));
  }

  // Mark missing rows as sold
  const soldIds: string[] = [];
  for (const r of existingRows ?? []) {
    if (!stillOpenIds.has(r.id as string)) soldIds.push(r.id as string);
  }
  if (soldIds.length > 0) {
    await supabaseAdmin
      .from("paladium_player_listings_history")
      .update({ sold_at: now })
      .in("id", soldIds);
  }

  // Insert new listings (best-effort, ignore unique conflicts)
  if (toInsert.length > 0) {
    await supabaseAdmin.from("paladium_player_listings_history").insert(
      toInsert.map((r) => ({
        ...r,
        first_seen_at: now,
      })),
    );
  }

  const { data: trackedExisting } = await supabaseAdmin
    .from("paladium_tracked_players")
    .select("uuid")
    .eq("uuid", uuid)
    .maybeSingle();
  if (trackedExisting) {
    await supabaseAdmin
      .from("paladium_tracked_players")
      .update({ last_synced_at: now, username })
      .eq("uuid", uuid);
  } else {
    await supabaseAdmin.from("paladium_tracked_players").insert({
      uuid,
      username,
      search_count: 0,
      first_searched_at: now,
      last_searched_at: now,
      last_synced_at: now,
    });
  }
}

export const trackPlayerSearch = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uuid: z.string().regex(UUID_RE),
        username: z.string().min(1).max(32),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession();
    const now = new Date().toISOString();
    // Upsert via select+insert/update (no on_conflict needed)
    const { data: existing } = await supabaseAdmin
      .from("paladium_tracked_players")
      .select("uuid, search_count")
      .eq("uuid", data.uuid)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("paladium_tracked_players")
        .update({
          username: data.username,
          search_count: (existing.search_count as number) + 1,
          last_searched_at: now,
        })
        .eq("uuid", data.uuid);
    } else {
      await supabaseAdmin.from("paladium_tracked_players").insert({
        uuid: data.uuid,
        username: data.username,
        search_count: 1,
        first_searched_at: now,
        last_searched_at: now,
      });
    }

    // Fire-and-forget snapshot
    snapshotPlayerListings(data.uuid, data.username).catch(() => {});

    return { ok: true };
  });

export const getTopSearchedPlayers = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await supabaseAdmin
    .from("paladium_tracked_players")
    .select("uuid, username, search_count, last_searched_at")
    .order("search_count", { ascending: false })
    .limit(10);
  if (error)
    return {
      players: [] as Array<{
        uuid: string;
        username: string;
        search_count: number;
        last_searched_at: string;
      }>,
    };
  return {
    players: (data ?? []) as Array<{
      uuid: string;
      username: string;
      search_count: number;
      last_searched_at: string;
    }>,
  };
});

export const getPlayerSalesHistory = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ uuid: z.string().regex(UUID_RE) }).parse(input))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: rows } = await supabaseAdmin
      .from("paladium_player_listings_history")
      .select("*")
      .eq("player_uuid", data.uuid)
      .order("first_seen_at", { ascending: false })
      .limit(200);
    const all = (rows ?? []) as Array<{
      id: string;
      item_name: string;
      quantity: number;
      price: number;
      price_pb: number | null;
      listed_at: string | null;
      first_seen_at: string;
      last_seen_at: string;
      sold_at: string | null;
    }>;
    return {
      open: all.filter((r) => !r.sold_at),
      sold: all.filter((r) => !!r.sold_at),
    };
  });

export const syncTrackedPlayersListings = createServerFn({ method: "POST" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("paladium_tracked_players")
    .select("uuid, username")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(30);
  const players = (data ?? []) as Array<{ uuid: string; username: string }>;
  for (const p of players) {
    await snapshotPlayerListings(p.uuid, p.username);
    // Small delay to spread rate-limit usage
    await new Promise((r) => setTimeout(r, 200));
  }
  return { processed: players.length };
});
