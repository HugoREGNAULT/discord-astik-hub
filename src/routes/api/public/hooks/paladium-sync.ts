import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { syncTrackedPlayersListings } from "@/lib/paladium/tracked-players.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-sync")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const res = await syncTrackedPlayersListings();
          return Response.json({ success: true, ...res });
        } catch (err) {
          console.error("paladium-sync failed", err);
          return new Response(
            JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : "unknown",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
