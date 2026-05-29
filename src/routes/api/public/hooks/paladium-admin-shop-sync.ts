import { createFileRoute } from "@tanstack/react-router";
import { snapshotAdminShop } from "@/lib/paladium/history.functions";

export const Route = createFileRoute("/api/public/hooks/paladium-admin-shop-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const res = await snapshotAdminShop();
          return Response.json({ success: true, ...res });
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
