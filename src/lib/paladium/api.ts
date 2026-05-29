// Paladium + Mojang API client.
// Paladium calls go through a TanStack server function so the API key
// (PALADIUM_API_KEY) stays server-side. Mojang is public and stays on the client.

import { callPaladium } from "./paladium.functions";
import { resolveMojangUuid } from "./mojang.functions";
import { updateRate } from "./rate-limits";

const MOJANG_BASE = "https://api.mojang.com";

export class PaladiumApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PaladiumApiError";
  }
}

// Kept for backwards-compat with existing UI. The key now lives on the server,
// so from the client's POV it is always "available".
export function hasPaladiumKey() {
  return true;
}

export async function paladiumFetch<T = unknown>(path: string): Promise<T> {
  try {
    const res = await callPaladium({ data: { path } });
    if (res.rate) updateRate(path, res.rate);
    return JSON.parse(res.json) as T;
  } catch (err) {
    if (err instanceof PaladiumApiError) throw err;
    const message = err instanceof Error ? err.message : "Paladium request failed";
    const m = /Paladium API (\d{3})/.exec(message);
    const status = m ? Number(m[1]) : 0;
    throw new PaladiumApiError(message, status);
  }
}

/* ---------- Mojang ---------- */

export type MojangProfile = { id: string; name: string };

export async function resolveUuid(username: string): Promise<MojangProfile> {
  const u = username.trim();
  if (!u) throw new PaladiumApiError("Pseudo vide", 400);
  try {
    return await resolveMojangUuid({ data: { username: u } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mojang request failed";
    const status = /introuvable/i.test(message) ? 404 : 0;
    throw new PaladiumApiError(message, status);
  }
}

export function avatarUrl(uuid: string, size = 128) {
  return `https://crafatar.com/avatars/${uuid}?size=${size}&overlay`;
}

/* ---------- Paladium typed helpers ---------- */

export type PlayerProfile = {
  uuid: string;
  username: string;
  factionName?: string | null;
  faction?: string | null;
  rank?: string | null;
  grade?: string | null;
  money?: number;
  coins?: number;
  level?: number;
  experience?: number;
  firstJoin?: string | number;
  createdAt?: string | number;
  [k: string]: unknown;
};

export type PlayerJob = {
  name: string;
  level: number;
  experience?: number;
  xp?: number;
  [k: string]: unknown;
};

export type PaladiumProfile = {
  uuid: string;
  clicker?: {
    coins?: number;
    rps?: number;
    buildings?: Array<{
      name: string;
      amount: number;
      baseCost?: number;
      cost?: number;
      baseRps?: number;
      rps?: number;
      [k: string]: unknown;
    }>;
    upgrades?: Array<{
      name: string;
      bought?: boolean;
      cost?: number;
      gainRps?: number;
      [k: string]: unknown;
    }>;
  };
  cliccoins?: number;
  rps?: number;
  [k: string]: unknown;
};

export type FactionProfile = {
  name: string;
  uuid?: string;
  description?: string | null;
  access?: string;
  createdAt?: number;
  alliance?: string | null;
  level?: { level: number; xp: number };
  emblem?: Record<string, number>;
  players?: Array<{ uuid: string; username: string; group?: string; joinedAt?: number }>;
  [k: string]: unknown;
};

export type ServerStatus = {
  servers?: Array<{ name: string; online: number; max?: number; status?: string }>;
  paladium?: { online: number; max?: number };
  anarchie?: { online: number; max?: number };
  [k: string]: unknown;
};

export type MarketItem = {
  id?: string;
  item?: string;
  name?: string;
  price?: number;
  amount?: number;
  quantity?: number;
  seller?: string;
  sellerName?: string;
  [k: string]: unknown;
};

export type LeaderboardEntry = {
  rank?: number;
  uuid?: string;
  username?: string;
  faction?: string;
  value?: number;
  [k: string]: unknown;
};

export type MarketItemsPage = {
  data: Array<{
    name: string;
    countListings?: number;
    quantityAvailable?: number;
    quantitySoldTotal?: number;
    priceAverage?: number;
    priceSum?: number;
    listing?: Array<{
      seller?: string;
      sellerName?: string;
      price?: number;
      pricePB?: number;
      quantity?: number;
      createdAt?: number;
      expireAt?: number;
    }>;
  }>;
  totalCount: number;
};

export type PlayerMarketResponse = {
  data: Array<{
    name?: string;
    item?: string;
    listing?: Array<{
      price?: number;
      pricePB?: number;
      quantity?: number;
      createdAt?: number;
      expireAt?: number;
    }>;
  }>;
  totalCount?: number;
};

export type EventEntry = {
  id?: string;
  name?: string;
  type?: string;
  startAt?: number;
  endAt?: number;
  description?: string;
  [k: string]: unknown;
};

export type TrixiumEntry = {
  position?: number;
  rank?: number;
  uuid?: string;
  username?: string;
  factionName?: string;
  value?: number;
  trixium?: number;
  [k: string]: unknown;
};

export type AdminShopItem = {
  name?: string;
  category?: string;
  price?: number;
  pricePB?: number;
  [k: string]: unknown;
};

export const PaladiumApi = {
  getPlayerProfile: (uuid: string) =>
    paladiumFetch<PlayerProfile>(`/v1/paladium/player/profile/${uuid}`),
  getPlayerJobs: (uuid: string) =>
    paladiumFetch<PlayerJob[] | { jobs: PlayerJob[] }>(`/v1/paladium/player/profile/${uuid}/jobs`),
  getPaladiumProfile: (uuid: string) =>
    paladiumFetch<PaladiumProfile>(`/v1/paladium/player/profile/${uuid}/clicker`),
  getFaction: (name: string) =>
    paladiumFetch<FactionProfile>(`/v1/paladium/faction/profile/${encodeURIComponent(name)}`),
  getStatus: () => paladiumFetch<unknown>(`/v1/status`),
  getMarketItemsPage: (offset = 0, limit = 100) =>
    paladiumFetch<MarketItemsPage>(
      `/v1/paladium/shop/market/items?limit=${limit}&offset=${offset}`,
    ),
  getMarketItem: (item: string) =>
    paladiumFetch<MarketItemsPage["data"][number]>(
      `/v1/paladium/shop/market/items/${encodeURIComponent(item)}`,
    ),
  getPlayerMarketItems: (uuid: string) =>
    paladiumFetch<PlayerMarketResponse>(
      `/v1/paladium/shop/market/players/${encodeURIComponent(uuid)}/items`,
    ),
  getLeaderboard: (category = "money", page = 1) =>
    paladiumFetch<LeaderboardEntry[] | { entries: LeaderboardEntry[] }>(
      `/v1/paladium/ranking/leaderboard/${encodeURIComponent(category)}/${page}`,
    ),
  getFactionLeaderboard: () =>
    paladiumFetch<LeaderboardEntry[] | { entries: LeaderboardEntry[] }>(
      `/v1/paladium/faction/leaderboard`,
    ),
  getAdminShop: () =>
    paladiumFetch<AdminShopItem[] | { items: AdminShopItem[] }>(`/v1/paladium/shop/admin/items`),
  getEvents: () => paladiumFetch<EventEntry[] | { events: EventEntry[] }>(`/v1/paladium/events`),
  getUpcomingEvents: () =>
    paladiumFetch<EventEntry[] | { events: EventEntry[] }>(`/v1/paladium/events/upcoming`),
  getOnYourMark: () => paladiumFetch<unknown>(`/v1/paladium/faction/onyourmark`),
  getFactionQuests: () => paladiumFetch<unknown>(`/v1/paladium/faction/quests`),
  getTrixiumPlayers: () =>
    paladiumFetch<TrixiumEntry[] | { entries: TrixiumEntry[] }>(
      `/v1/paladium/trixium/leaderboard/players`,
    ),
  getTrixiumFactions: () =>
    paladiumFetch<TrixiumEntry[] | { entries: TrixiumEntry[] }>(
      `/v1/paladium/trixium/leaderboard/factions`,
    ),
};

export function asArray<T>(value: T[] | { [k: string]: unknown } | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // Try common keys
  for (const k of ["items", "jobs", "entries", "data", "results"]) {
    const v = (value as Record<string, unknown>)[k];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}
