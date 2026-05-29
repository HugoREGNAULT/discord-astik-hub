import { createFileRoute } from "@tanstack/react-router";
import { syncTrackedPlayersListings } from "@/lib/paladium/tracked-players.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-sync")({
  server: {
    handlers: {
      POST: async () => {
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
