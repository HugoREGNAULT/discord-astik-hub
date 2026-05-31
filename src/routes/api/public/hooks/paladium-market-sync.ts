import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { snapshotMarketPrices } from "@/lib/paladium/history.functions";
import { evaluateMarketAlerts } from "@/lib/data/shop-alerts.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-market-sync")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const res = await snapshotMarketPrices();
          let alerts = { fired: 0, rearmed: 0 };
          try {
            alerts = await evaluateMarketAlerts();
          } catch (e) {
            console.error("evaluateMarketAlerts failed", e);
          }
          return Response.json({ success: true, ...res, alerts });
        } catch (err) {
          console.error("paladium-market-sync failed", err);
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
