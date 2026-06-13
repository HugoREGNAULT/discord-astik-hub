/**
 * Helpers utilisés dans les server functions pour exiger une session
 * et/ou une permission Discord.
 */

import { getSessionData, setSessionData, toSessionUser } from "./session.server";
import { canAccess, type Permission, type SessionUser } from "./permissions";
import { getAggregatedRolesCached } from "@/lib/discord/role-cache.server";
import { db } from "@/lib/db.server";
import { AppError, ERROR_MESSAGES } from "@/lib/errors";

const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function requireSession(): Promise<SessionUser> {
  const data = await getSessionData();
  if (!data) throw new AppError("UNAUTHENTICATED", 401, ERROR_MESSAGES.UNAUTHENTICATED);
  if (Date.now() - data.rolesRefreshedAt > ROLE_CACHE_TTL_MS) {
    try {
      const roles = await getAggregatedRolesCached(data.discordId);
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
  if (m?.status === "left")
    throw new AppError("FORBIDDEN_LEFT_GUILD", 403, ERROR_MESSAGES.FORBIDDEN_LEFT_GUILD);
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
    throw new AppError("FORBIDDEN", 403, ERROR_MESSAGES.FORBIDDEN);
  }
  return user;
}

export async function requireSelfOrPermission(
  targetDiscordId: string,
  perm: Permission,
): Promise<{ user: SessionUser; isSelf: boolean }> {
  const user = await requireSession();
  const isSelf = user.discordId === targetDiscordId;
  if (!isSelf && !canAccess(user, perm)) {
    await db.from("logs").insert({
      level: "warn",
      action: "permission_denied",
      actor_discord_id: user.discordId,
      payload: { permission: perm } as never,
    });
    throw new AppError("FORBIDDEN", 403, ERROR_MESSAGES.FORBIDDEN);
  }
  return { user, isSelf };
}

/**
 * Actions sensibles : pour chacune, on poste un embed récap dans le canal staff
 * (asynchrone, non bloquant). Pattern log.server.ts. La liste reste
 * conservatrice — on signale ce qui est irréversible ou qui touche aux
 * permissions / sanctions.
 */
const SENSITIVE_ACTIONS = new Set<string>([
  "member_delete",
  "permission_change",
  "points_remove",
  "application_reject",
  "warning_create",
  "donation_cancel",
  "config_value_delete",
  "blacklist_add",
]);

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
  if (level === "error") {
    const { reportError } = await import("@/lib/observability.server");
    reportError(action, new Error(action), { actor: actorId, ...payload });
  }
  if (SENSITIVE_ACTIONS.has(action)) {
    // Fire-and-forget : ne casse jamais l'appelant.
    void (async () => {
      try {
        const { postToChannel, COLORS } = await import("@/lib/discord/log.server");
        const { notifyChannels } = await import("@/lib/discord/notify-channels.server");
        if (!notifyChannels.STAFF) return;
        const fields = Object.entries(payload)
          .slice(0, 10)
          .map(([k, v]) => ({
            name: k,
            value: "```" + JSON.stringify(v).slice(0, 900) + "```",
            inline: false,
          }));
        await postToChannel(notifyChannels.STAFF, {
          embeds: [
            {
              title: `🔐 Action sensible · ${action}`,
              description: `Acteur : \`${actorId}\``,
              color: COLORS.warn,
              timestamp: new Date().toISOString(),
              fields,
              footer: { text: "Audit log PunkAstik" },
            },
          ],
        });
      } catch (e) {
        console.error("[logAction] sensitive alert failed", (e as Error).message);
      }
    })();
  }
}
