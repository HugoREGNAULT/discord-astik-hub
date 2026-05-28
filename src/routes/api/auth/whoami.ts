/**
 * GET /api/auth/whoami
 * Endpoint de diagnostic post-publication.
 * Retourne l'identité Discord de la session courante (id, pseudo, avatar, rôles).
 * Renvoie 401 si non connecté. Aucun secret n'est exposé.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getSessionData } from "@/lib/auth/session.server";
import { GUILDS } from "@/lib/discord/constants";

export const Route = createFileRoute("/api/auth/whoami")({
  server: {
    handlers: {
      GET: async () => {
        const s = await getSessionData();
        if (!s) {
          return Response.json(
            { authenticated: false, loginUrl: "/api/auth/login" },
            { status: 401 },
          );
        }
        const avatarUrl = s.avatar
          ? `https://cdn.discordapp.com/avatars/${s.discordId}/${s.avatar}.png?size=256`
          : `https://cdn.discordapp.com/embed/avatars/${(BigInt(s.discordId) >> 22n) % 6n}.png`;

        return Response.json({
          authenticated: true,
          discordId: s.discordId,
          username: s.username,
          globalName: s.globalName ?? null,
          avatar: s.avatar,
          avatarUrl,
          rolesCount: s.roleIds?.length ?? 0,
          rolesRefreshedAt: s.rolesRefreshedAt
            ? new Date(s.rolesRefreshedAt).toISOString()
            : null,
          tokenExpiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
          tokenExpired: s.expiresAt ? Date.now() > s.expiresAt : null,
          guildsMonitored: { public: GUILDS.PUBLIC, faction: GUILDS.FACTION },
        });
      },
    },
  },
});
