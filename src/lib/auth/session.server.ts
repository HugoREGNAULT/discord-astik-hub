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

function getSessionConfig() {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
    }
    console.warn(
      "[session] SESSION_SECRET is shorter than 32 chars — padding for dev. Set a 32+ char secret in production.",
    );
  }
  return {
    password: secret.padEnd(32, "_"),

    name: "punkastik_session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: true,
      path: "/",
    },
  };
}

export async function getSessionManager() {
  return useSession<DiscordSessionData>(getSessionConfig());
}

export async function getSessionData(): Promise<DiscordSessionData | null> {
  const s = await getSessionManager();
  const d = s.data as Partial<DiscordSessionData> | undefined;
  return d && d.discordId ? (d as DiscordSessionData) : null;
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
