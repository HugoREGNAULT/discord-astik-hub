/**
 * GET /api/auth/login
 * Redirige vers la page de consentement Discord OAuth2.
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
        return new Response(null, {
          status: 302,
          headers: {
            Location: authorizeUrl,
            "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          },
        });
      },
    },
  },
});
