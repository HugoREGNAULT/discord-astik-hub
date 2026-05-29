import { createFileRoute } from "@tanstack/react-router";
import { snapshotServerStatus } from "@/lib/paladium/history.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-status-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const res = await snapshotServerStatus();
          return Response.json({ success: true, ...res });
        } catch (err) {
          console.error("paladium-status-sync failed", err);
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
