/**
 * GET /api/auth/callback?code=...&state=...
 * Échange le code, récupère l'identité Discord + rôles agrégés,
 * crée la session, upsert le profil membre, redirige vers /profile.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeCode,
  getCurrentDiscordUser,
  fetchAggregatedRoles,
} from "@/lib/discord/api.server";
import { setSessionData } from "@/lib/auth/session.server";
import { db } from "@/lib/db.server";
import { ROLES } from "@/lib/discord/constants";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieHeader = request.headers.get("cookie") || "";
        const stateCookie = /(?:^|;\s*)oauth_state=([^;]+)/.exec(cookieHeader)?.[1];
        const nextCookieRaw = /(?:^|;\s*)oauth_next=([^;]*)/.exec(cookieHeader)?.[1] ?? "";
        const nextDecoded = decodeURIComponent(nextCookieRaw);
        const nextPath =
          nextDecoded.startsWith("/") && !nextDecoded.startsWith("//")
            ? nextDecoded
            : "/me";

        if (!code || !state || !stateCookie || state !== stateCookie) {
          return new Response("Invalid OAuth state", { status: 400 });
        }

        const redirectUri = `${url.origin}/api/auth/callback`;
        try {
          const token = await exchangeCode(code, redirectUri);
          const user = await getCurrentDiscordUser(token.access_token);
          const roleIds = await fetchAggregatedRoles(user.id);

          await setSessionData({
            discordId: user.id,
            username: user.username,
            globalName: user.global_name,
            avatar: user.avatar,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: Date.now() + token.expires_in * 1000,
            roleIds,
            rolesRefreshedAt: Date.now(),
          });

          // Upsert minimal member profile si membre faction (sinon juste log)
          const isMember = roleIds.includes(ROLES.MEMBER_FACTION);
          if (isMember) {
            await db.from("members").upsert(
              {
                discord_id: user.id,
                discord_username: user.username,
                avatar_url: user.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                  : null,
              },
              { onConflict: "discord_id" },
            );
          }

          await db.from("logs").insert({
            level: "info",
            action: "login",
            actor_discord_id: user.id,
            payload: { roles: roleIds.length } as never,
          });

          const headers = new Headers({ Location: nextPath });
          headers.append("Set-Cookie", "oauth_state=; Path=/; Max-Age=0");
          headers.append("Set-Cookie", "oauth_next=; Path=/; Max-Age=0");
          return new Response(null, { status: 302, headers });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[oauth callback]", e);
          return new Response(`OAuth callback failed: ${(e as Error).message}`, { status: 500 });
        }
      },
    },
  },
});

    },
  },
});
