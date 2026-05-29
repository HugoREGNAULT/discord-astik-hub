/**
 * Helpers utilisés dans les server functions pour exiger une session
 * et/ou une permission Discord.
 */

import { getSessionData, setSessionData, toSessionUser } from "./session.server";
import { canAccess, type Permission, type SessionUser } from "./permissions";
import { fetchAggregatedRoles } from "@/lib/discord/api.server";
import { db } from "@/lib/db.server";

const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function requireSession(): Promise<SessionUser> {
  const data = await getSessionData();
  if (!data) throw new Error("UNAUTHENTICATED");
  if (Date.now() - data.rolesRefreshedAt > ROLE_CACHE_TTL_MS) {
    try {
      const roles = await fetchAggregatedRoles(data.discordId);
      data.roleIds = roles;
      data.rolesRefreshedAt = Date.now();
      await setSessionData(data);
    } catch {
      // ignore refresh failure, use cached
    }
  }
  // Si l'utilisateur figure dans members et est marqué "left", bloquer l'accès.
  const { data: m } = await db
    .from("members")
    .select("status")
    .eq("discord_id", data.discordId)
    .maybeSingle();
  if (m?.status === "left") throw new Error("FORBIDDEN_LEFT_GUILD");
  return toSessionUser(data);
}

export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireSession();
  if (!canAccess(user, perm)) {
    await db.from("logs").insert({
      level: "warn",
      action: "permission_denied",
      actor_discord_id: user.discordId,
      payload: { permission: perm } as never,
    });
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function logAction(
  action: string,
  actorId: string,
  payload: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
) {
  await db.from("logs").insert({
    level,
    action,
    actor_discord_id: actorId,
    payload: payload as never,
  });
}
