/**
 * Pont permissions <-> bot.
 * Convertit un payload bot (discord_id + roleIds) en SessionUser et permet de
 * gater des actions via la même table de permissions que le site.
 */
import { canAccess, type Permission, type SessionUser } from "@/lib/auth/permissions";

export function botUserFromPayload(
  roleIds: string[],
  discordId: string,
  username: string,
): SessionUser {
  return {
    discordId,
    username,
    globalName: null,
    avatar: null,
    roleIds: Array.isArray(roleIds) ? roleIds.filter((r) => typeof r === "string") : [],
  };
}

export class BotPermissionError extends Error {
  status = 403;
  constructor(public permission: Permission) {
    super(`Forbidden: missing permission ${permission}`);
  }
}

export function requireBotPermission(roleIds: string[], perm: Permission): void {
  const user = botUserFromPayload(roleIds, "bot-actor", "bot");
  if (!canAccess(user, perm)) throw new BotPermissionError(perm);
}
