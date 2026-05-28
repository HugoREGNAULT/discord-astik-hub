import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/lib/db.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        let dbOk = false;
        let dbError: string | null = null;
        try {
          const { error } = await db.from("members").select("discord_id", { head: true, count: "exact" }).limit(1);
          if (error) dbError = error.message;
          else dbOk = true;
        } catch (e) {
          dbError = (e as Error).message;
        }
        const body = {
          ok: dbOk,
          uptimeMs: Date.now() - started,
          checks: {
            db: { ok: dbOk, error: dbError },
            discordBotConfigured: Boolean(process.env.DISCORD_BOT_TOKEN),
            discordOauthConfigured:
              Boolean(process.env.DISCORD_CLIENT_ID) && Boolean(process.env.DISCORD_CLIENT_SECRET),
          },
          time: new Date().toISOString(),
        };
        return new Response(JSON.stringify(body, null, 2), {
          status: dbOk ? 200 : 503,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
