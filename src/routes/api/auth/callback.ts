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
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

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
          nextDecoded.startsWith("/") && !nextDecoded.startsWith("//") ? nextDecoded : "/me";

        console.log(
          "[AUTH-DEBUG] /api/auth/callback → code présent:",
          !!code,
          "| state présent:",
          !!state,
          "| stateCookie présent:",
          !!stateCookie,
          "| state===stateCookie:",
          state === stateCookie,
        );

        if (!code || !state || !stateCookie || state !== stateCookie) {
          const reason = !code
            ? "code manquant"
            : !state
              ? "state manquant"
              : !stateCookie
                ? "stateCookie absent — cookie oauth_state non reçu (Secure/SameSite? cross-origin?)"
                : `state !== stateCookie (mismatch: state="${state}" stateCookie="${stateCookie}")`;
          console.error("[AUTH-DEBUG] Invalid OAuth state — raison:", reason);
          return new Response("Invalid OAuth state", { status: 400 });
        }

        const redirectUri = `${url.origin}/api/auth/callback`;
        try {
          const token = await exchangeCode(code, redirectUri);
          console.log("[AUTH-DEBUG] exchangeCode → token OK");

          const user = await getCurrentDiscordUser(token.access_token);
          console.log(
            "[AUTH-DEBUG] getCurrentDiscordUser → id:",
            user.id,
            "| username:",
            user.username,
          );

          const roleIds = await fetchAggregatedRoles(user.id);
          console.log(
            "[AUTH-DEBUG] fetchAggregatedRoles → roleIds.length:",
            roleIds.length,
            "| contient MEMBER_FACTION:",
            roleIds.includes(ROLES.MEMBER_FACTION),
          );

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

          console.log("[AUTH-DEBUG] setSessionData → session set | nextPath:", nextPath);

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

          await logToDiscord("auth", {
            title: "🔐 Connexion",
            color: isMember ? COLORS.success : COLORS.info,
            description: `**${user.global_name ?? user.username}** (\`${user.username}\`) s'est connecté${isMember ? " — *membre faction*" : ""}.`,
            fields: [
              { name: "Discord ID", value: `\`${user.id}\``, inline: true },
              { name: "Rôles", value: String(roleIds.length), inline: true },
              { name: "Redirection", value: nextPath, inline: true },
            ],
          });

          const headers = new Headers({ Location: nextPath });
          headers.append("Set-Cookie", "oauth_state=; Path=/; Max-Age=0");
          headers.append("Set-Cookie", "oauth_next=; Path=/; Max-Age=0");
          return new Response(null, { status: 302, headers });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[oauth callback]", msg, e);
          return new Response("Authentication failed. Please try again.", { status: 500 });
        }
      },
    },
  },
});
