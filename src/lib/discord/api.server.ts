/**
 * Discord API client (server-only).
 *
 * - OAuth2 token exchange / refresh
 * - GET /users/@me
 * - GET /guilds/{id}/members/{userId}  (bot endpoint — uses bot token)
 * - GET /guilds/{id}/members           (liste, pagination)
 */

import { DISCORD_API, DISCORD_OAUTH_SCOPES, GUILDS } from "./constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

const CLIENT_ID = () => process.env.DISCORD_CLIENT_ID!;
const CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET!;
const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!;

export function buildAuthorizeUrl(redirectUri: string, state: string) {
  const u = new URL("https://discord.com/oauth2/authorize");
  u.searchParams.set("client_id", CLIENT_ID());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", DISCORD_OAUTH_SCOPES.join(" "));
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "none");
  return u.toString();
}

export interface DiscordToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<DiscordToken> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID(),
    client_secret: CLIENT_SECRET(),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetchWithRetry(
    `${DISCORD_API}/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    { bucket: "discord" },
  );
  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export async function getCurrentDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetchWithRetry(
    `${DISCORD_API}/users/@me`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { bucket: "discord" },
  );
  if (!res.ok) throw new Error(`Discord /users/@me failed: ${res.status}`);
  return res.json();
}

export interface DiscordGuildMember {
  user?: DiscordUser;
  nick?: string | null;
  roles: string[];
  joined_at: string;
  avatar?: string | null;
}

/** Récupère un membre via le bot (token bot requis pour membres tiers). */
export async function getGuildMember(
  guildId: string,
  userId: string,
): Promise<DiscordGuildMember | null> {
  const res = await fetchWithRetry(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
    { headers: { Authorization: `Bot ${BOT_TOKEN()}` } },
    { bucket: "discord" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Discord guild member failed: ${res.status}`);
  return res.json();
}

/** Liste paginée des membres d'un guild (jusqu'à 1000 par page). */
export async function listGuildMembers(
  guildId: string,
  opts: { after?: string; limit?: number } = {},
): Promise<DiscordGuildMember[]> {
  const limit = opts.limit ?? 1000;
  const url = new URL(`${DISCORD_API}/guilds/${guildId}/members`);
  url.searchParams.set("limit", String(limit));
  if (opts.after) url.searchParams.set("after", opts.after);
  const res = await fetchWithRetry(
    url,
    { headers: { Authorization: `Bot ${BOT_TOKEN()}` } },
    { bucket: "discord" },
  );
  if (!res.ok) throw new Error(`Discord list members failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Récupère tous les membres d'un guild (pagine automatiquement). */
export async function listAllGuildMembers(guildId: string): Promise<DiscordGuildMember[]> {
  const all: DiscordGuildMember[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const page = await listGuildMembers(guildId, { after });
    all.push(...page);
    if (page.length < 1000) break;
    const last = page[page.length - 1];
    after = last.user?.id;
    if (!after) break;
  }
  return all;
}

/**
 * Ajoute un rôle Discord à un membre d'un guild.
 * Retourne { ok: true } si succès (204) ou si l'utilisateur a déjà le rôle.
 */
export async function addGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, status: 0, error: "DISCORD_BOT_TOKEN missing" };
  }
  const res = await fetchWithRetry(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN()}`,
        "Content-Length": "0",
      },
    },
    { bucket: "discord" },
  );
  if (res.status === 204) return { ok: true, status: 204 };
  const body = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: body || `HTTP ${res.status}` };
}

/** Récupère les rôles agrégés d'un user sur les deux serveurs surveillés. */
export async function fetchAggregatedRoles(userId: string): Promise<string[]> {
  const [pub, fac] = await Promise.all([
    getGuildMember(GUILDS.PUBLIC, userId).catch(() => null),
    getGuildMember(GUILDS.FACTION, userId).catch(() => null),
  ]);
  const roles = new Set<string>();
  pub?.roles.forEach((r) => roles.add(r));
  fac?.roles.forEach((r) => roles.add(r));
  return Array.from(roles);
}

/**
 * Ping léger de l'API Discord (GET /gateway), avec cache mémoire 30 s.
 * Utilisé par l'overview admin pour éviter de marteler Discord à chaque rendu.
 */
let pingCache: { ok: boolean; latencyMs: number; at: number } | null = null;
const PING_TTL_MS = 30_000;

export async function pingDiscord(): Promise<{ ok: boolean; latencyMs: number; at: number }> {
  if (pingCache && Date.now() - pingCache.at < PING_TTL_MS) return pingCache;
  let ok = false;
  let latencyMs = 0;
  try {
    const t0 = Date.now();
    const r = await fetchWithRetry(
      `${DISCORD_API}/gateway`,
      { method: "GET" },
      { bucket: "discord", retries: 0, timeoutMs: 3000 },
    );
    latencyMs = Date.now() - t0;
    ok = r.ok;
  } catch {
    ok = false;
  }
  pingCache = { ok, latencyMs, at: Date.now() };
  return pingCache;
}
