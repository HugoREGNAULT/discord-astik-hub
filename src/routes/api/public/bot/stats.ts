import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";

// Direct SET of rolling-window values calculated by the bot.
// Useful for a true 7-day rolling window the bot recomputes periodically.
const schema = z.object({
  discord_id: z.string().min(1).max(64),
  messages_7d: z.number().int().min(0).optional(),
  voice_7d_seconds: z.number().int().min(0).optional(),
  messages_total: z.number().int().min(0).optional(),
  voice_total_seconds: z.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/public/bot/stats")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);

        const { discord_id, ...patch } = parsed.data;
        if (Object.keys(patch).length === 0) return json({ error: "No stats provided" }, 400);

        const { error } = await db.from("members").update(patch).eq("discord_id", discord_id);
        if (error) return json({ error: error.message }, 500);

        return json({ ok: true, applied: patch });
      },
    },
  },
});
