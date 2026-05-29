import { createFileRoute } from "@tanstack/react-router";
import { snapshotAdminShop } from "@/lib/paladium/history.functions";
import { evaluateShopAlerts } from "@/lib/data/shop-alerts.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-admin-shop-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const res = await snapshotAdminShop();
          let alerts = { fired: 0, rearmed: 0 };
          try {
            alerts = await evaluateShopAlerts();
          } catch (e) {
            console.error("evaluateShopAlerts failed", e);
          }
          return Response.json({ success: true, ...res, alerts });
        } catch (err) {
          console.error("paladium-admin-shop-sync failed", err);
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
