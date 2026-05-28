/**
 * Session helpers (server-only).
 *
 * Utilise l'encrypted cookie session de TanStack Start. La session stocke
 * le profil Discord + access/refresh token + un cache des rôles. Le token
 * Discord ne sort JAMAIS du cookie httpOnly.
 */

import { useSession } from "@tanstack/react-start/server";
import type { SessionUser } from "./permissions";

export interface DiscordSessionData {
  discordId: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  roleIds: string[];
  rolesRefreshedAt: number;
}

const SECRET = process.env.SESSION_SECRET || "";
if (SECRET.length < 32) {
  // Padded fallback so dev doesn't crash, but warn loudly in logs.
  // eslint-disable-next-line no-console
  console.warn(
    "[session] SESSION_SECRET is shorter than 32 chars — padding for dev. Set a 32+ char secret in production.",
  );
}
const SESSION_PASSWORD = SECRET.padEnd(32, "_");

const SESSION_CONFIG = {
  password: SESSION_PASSWORD,
  name: "punkastik_session",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  cookie: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
  },
};

export async function getSessionManager() {
  return useSession<DiscordSessionData>(SESSION_CONFIG);
}

export async function getSessionData(): Promise<DiscordSessionData | null> {
  const s = await getSessionManager();
  // useSession returns {} when no session — check for required field
  return s.data && s.data.discordId ? s.data : null;
}

export async function setSessionData(data: DiscordSessionData) {
  const s = await getSessionManager();
  await s.update(data);
}

export async function clearSessionData() {
  const s = await getSessionManager();
  await s.clear();
}

/** Convert a session into the lean SessionUser passed to canAccess. */
export function toSessionUser(d: DiscordSessionData): SessionUser {
  return {
    discordId: d.discordId,
    username: d.username,
    globalName: d.globalName,
    avatar: d.avatar,
    roleIds: d.roleIds,
  };
}
