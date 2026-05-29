// Paladium + Mojang API client.
// Paladium calls go through a TanStack server function so the API key
// (PALADIUM_API_KEY) stays server-side. Mojang is public and stays on the client.

import { callPaladium } from "./paladium.functions";

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
    const { json } = await callPaladium({ data: { path } });
    return JSON.parse(json) as T;
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
  const res = await fetch(`${MOJANG_BASE}/users/profiles/minecraft/${encodeURIComponent(u)}`);
  if (res.status === 204 || res.status === 404) {
    throw new PaladiumApiError(`Pseudo "${u}" introuvable sur Mojang`, 404);
  }
  if (!res.ok) {
    throw new PaladiumApiError(`Mojang API ${res.status}`, res.status);
  }
  const data = (await res.json()) as MojangProfile;
  // Convert "compact" uuid -> dashed if needed
  if (data.id && data.id.length === 32) {
    data.id = `${data.id.slice(0, 8)}-${data.id.slice(8, 12)}-${data.id.slice(12, 16)}-${data.id.slice(16, 20)}-${data.id.slice(20)}`;
  }
  return data;
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
  description?: string | null;
  level?: number;
  members?: Array<{ uuid: string; username: string; role?: string }>;
  allies?: string[];
  enemies?: string[];
  power?: number;
  stats?: Record<string, number | string>;
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

export const PaladiumApi = {
  getPlayerProfile: (uuid: string) =>
    paladiumFetch<PlayerProfile>(`/v1/paladium/player/profile/${uuid}`),
  getPlayerJobs: (uuid: string) =>
    paladiumFetch<PlayerJob[] | { jobs: PlayerJob[] }>(
      `/v1/paladium/player/profile/${uuid}/jobs`,
    ),
  getPaladiumProfile: (uuid: string) =>
    paladiumFetch<PaladiumProfile>(`/v1/paladium/player/profile/${uuid}/clicker`),
  getFaction: (name: string) =>
    paladiumFetch<FactionProfile>(`/v1/paladium/faction/profile/${encodeURIComponent(name)}`),
  getStatus: () => paladiumFetch<ServerStatus>(`/v1/status`),
  getMarketItems: () =>
    paladiumFetch<MarketItem[] | { items: MarketItem[] }>(`/v1/paladium/shop/market/items`),
  getMarketItem: (item: string) =>
    paladiumFetch<MarketItem | { items: MarketItem[] }>(
      `/v1/paladium/shop/market/items/${encodeURIComponent(item)}`,
    ),
  getLeaderboard: (category = "money") =>
    paladiumFetch<LeaderboardEntry[] | { entries: LeaderboardEntry[] }>(
      `/v1/paladium/ranking/leaderboard/${encodeURIComponent(category)}/1`,
    ),
  getFactionLeaderboard: () =>
    paladiumFetch<LeaderboardEntry[] | { entries: LeaderboardEntry[] }>(
      `/v1/paladium/faction/leaderboard`,
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
