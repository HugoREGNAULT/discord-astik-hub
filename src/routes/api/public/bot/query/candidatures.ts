import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { requireBotPermission, BotPermissionError } from "@/lib/bot-permissions.server";

const schema = z.object({
  actor_discord_id: z.string().min(1).max(64),
  actor_role_ids: z.array(z.string()).max(200),
});

export const Route = createFileRoute("/api/public/bot/query/candidatures")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = schema.safeParse(body);
        if (!parsed.success)
          return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);

        try {
          requireBotPermission(parsed.data.actor_role_ids, "recruit.access");
        } catch (e) {
          if (e instanceof BotPermissionError) return json({ error: "Forbidden" }, 403);
          throw e;
        }

        const res = await db
          .from("applications")
          .select("id, mc_name, discord_username, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(50);
        if (res.error) return json({ error: res.error.message }, 500);

        return json({ ok: true, data: { applications: res.data ?? [] } });
      },
    },
  },
});
