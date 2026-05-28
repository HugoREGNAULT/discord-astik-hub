/**
 * Server functions liées à la session utilisateur (lues côté client).
 * Aucun secret exposé : on renvoie uniquement le profil public + permissions.
 */
import { createServerFn } from "@tanstack/react-start";
import { getSessionData, toSessionUser } from "@/lib/auth/session.server";
import { listPermissions, type Permission } from "@/lib/auth/permissions";

export interface CurrentUser {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  roleIds: string[];
  permissions: Permission[];
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const data = await getSessionData();
    if (!data) return null;
    const user = toSessionUser(data);
    return {
      discordId: user.discordId,
      username: user.username,
      globalName: user.globalName ?? null,
      avatar: user.avatar ?? null,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
        : null,
      roleIds: user.roleIds,
      permissions: listPermissions(user),
    };
  },
);
