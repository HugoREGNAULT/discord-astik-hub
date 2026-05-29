import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";

const schema = z.object({
  discord_id: z.string().min(1).max(64),
  seconds: z.number().int().min(1).max(86_400),
});

export const Route = createFileRoute("/api/public/bot/voice")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success)
          return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);

        const { discord_id, seconds } = parsed.data;
        const { data: m, error: e1 } = await db
          .from("members")
          .select("voice_total_seconds, voice_7d_seconds")
          .eq("discord_id", discord_id)
          .maybeSingle();
        if (e1) return json({ error: e1.message }, 500);
        if (!m) return json({ error: "Unknown member" }, 404);

        const { error: e2 } = await db
          .from("members")
          .update({
            voice_total_seconds: (m.voice_total_seconds ?? 0) + seconds,
            voice_7d_seconds: (m.voice_7d_seconds ?? 0) + seconds,
          })
          .eq("discord_id", discord_id);
        if (e2) return json({ error: e2.message }, 500);

        return json({ ok: true });
      },
    },
  },
});
