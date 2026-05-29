import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";

const schema = z.object({
  discord_id: z.string().min(1).max(64),
  discord_username: z.string().max(255).optional(),
  ig_name: z.string().max(255).optional(),
  avatar_url: z.string().url().max(2048).optional(),
  status: z.enum(["active", "inactive", "left"]).optional(),
  current_grade: z.string().max(64).optional(),
  arrival_date: z.string().optional(), // ISO date
});

export const Route = createFileRoute("/api/public/bot/member")({
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

        const payload = parsed.data;
        const { error } = await db.from("members").upsert(payload, { onConflict: "discord_id" });
        if (error) return json({ error: error.message }, 500);

        return json({ ok: true });
      },
    },
  },
});
