import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";

const schema = z.object({
  discord_id: z.string().min(1).max(64),
  count: z.number().int().min(1).max(1000).optional(),
});

export const Route = createFileRoute("/api/public/bot/message")({
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

        const { discord_id, count = 1 } = parsed.data;
        const { data: m, error: e1 } = await db
          .from("members")
          .select("messages_total, messages_7d")
          .eq("discord_id", discord_id)
          .maybeSingle();
        if (e1) return json({ error: e1.message }, 500);
        if (!m) return json({ error: "Unknown member" }, 404);

        const { error: e2 } = await db
          .from("members")
          .update({
            messages_total: (m.messages_total ?? 0) + count,
            messages_7d: (m.messages_7d ?? 0) + count,
          })
          .eq("discord_id", discord_id);
        if (e2) return json({ error: e2.message }, 500);

        return json({ ok: true });
      },
    },
  },
});
