/**
 * GET /api/auth/login?next=/path
 * Redirige vers la page de consentement Discord OAuth2.
 * Le paramètre `next` est stocké dans le state cookie pour rediriger après login.
 */
import { createFileRoute } from "@tanstack/react-router";
import { buildAuthorizeUrl } from "@/lib/discord/api.server";
import { randomBytes } from "crypto";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectUri = `${url.origin}/api/auth/callback`;
        const state = randomBytes(16).toString("hex");
        const authorizeUrl = buildAuthorizeUrl(redirectUri, state);

        // Whitelist : on n'accepte qu'un chemin interne relatif
        const rawNext = url.searchParams.get("next") || "";
        const next =
          rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

        const cookies = [
          `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          `oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        ];

        const headers = new Headers({ Location: authorizeUrl });
        for (const c of cookies) headers.append("Set-Cookie", c);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
