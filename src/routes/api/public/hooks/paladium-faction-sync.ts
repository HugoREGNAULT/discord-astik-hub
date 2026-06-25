import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { snapshotFactionWealth } from "@/lib/paladium/history.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-faction-sync")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const res = await snapshotFactionWealth();
          return Response.json({ success: true, ...res });
        } catch (err) {
          console.error("paladium-faction-sync failed", err);
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
