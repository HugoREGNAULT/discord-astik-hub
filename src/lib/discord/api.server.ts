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
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
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
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${BOT_TOKEN()}` },
  });
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
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${BOT_TOKEN()}` },
  });
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
