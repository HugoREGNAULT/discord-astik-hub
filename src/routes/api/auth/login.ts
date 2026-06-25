/**
 * GET /api/auth/login?next=/path
 * Redirige vers la page de consentement Discord OAuth2.
 * Rate-limited à 10 tentatives / 5 minutes / IP.
 */
import { createFileRoute } from "@tanstack/react-router";
import { buildAuthorizeUrl } from "@/lib/discord/api.server";
import { rateLimit, getClientIp } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ip = getClientIp(request);
        const rl = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
        if (!rl.ok) {
          return new Response(
            `Trop de tentatives. Réessaie dans ${Math.ceil(rl.resetIn / 1000)}s.`,
            {
              status: 429,
              headers: {
                "Retry-After": String(Math.ceil(rl.resetIn / 1000)),
                "Content-Type": "text/plain; charset=utf-8",
              },
            },
          );
        }

        const url = new URL(request.url);
        const redirectUri = `${url.origin}/api/auth/callback`;
        const state = crypto.randomUUID().replace(/-/g, "");
        const authorizeUrl = buildAuthorizeUrl(redirectUri, state);

        const rawNext = url.searchParams.get("next") || "";
        const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

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
