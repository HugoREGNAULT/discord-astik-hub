import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/lib/db.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        let dbOk = false;
        try {
          const { error } = await db
            .from("members")
            .select("discord_id", { head: true, count: "exact" })
            .limit(1);
          if (error) {
            console.error("[health] db check failed:", error.message);
          } else {
            dbOk = true;
          }
        } catch (e) {
          console.error("[health] db check threw:", (e as Error).message);
        }
        const body = {
          ok: dbOk,
          uptimeMs: Date.now() - started,
          time: new Date().toISOString(),
        };
        return new Response(JSON.stringify(body), {
          status: dbOk ? 200 : 503,
          headers: { "content-type": "application/json" },
        });

      },
    },
  },
});
