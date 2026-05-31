import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { generateWeeklyDigest } from "@/lib/data/digest.server";

/**
 * Hook public déclenché par pg_cron (lundi 10h Europe/Paris).
 * Génère le digest IA de la semaine précédente s'il n'existe pas déjà.
 *
 * Auth : header `x-bot-key` (BOT_API_KEY).
 */
export const Route = createFileRoute("/api/public/hooks/generate-digest")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const result = await generateWeeklyDigest({ generatedBy: "cron" });
          return Response.json(result);
        } catch (err) {
          console.error("generate-digest failed", err);
          return new Response(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : "unknown",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
