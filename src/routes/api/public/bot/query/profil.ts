import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { botUserFromPayload } from "@/lib/bot-permissions.server";
import { canAccess } from "@/lib/auth/permissions";

const schema = z.object({
  discord_id: z.string().min(1).max(64),
  actor_discord_id: z.string().min(1).max(64),
  actor_role_ids: z.array(z.string()).max(200),
});

export const Route = createFileRoute("/api/public/bot/query/profil")({
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
        const { discord_id, actor_discord_id, actor_role_ids } = parsed.data;

        const actor = botUserFromPayload(actor_role_ids, actor_discord_id, "bot-actor");
        const isSelf = actor_discord_id === discord_id;
        const allowed = isSelf ? canAccess(actor, "profile.self") : canAccess(actor, "members.view");
        if (!allowed) return json({ error: "Forbidden" }, 403);

        const r = await db
          .from("members")
          .select("discord_id, ig_name, current_grade, arrival_date, messages_7d, voice_7d_seconds")
          .eq("discord_id", discord_id)
          .maybeSingle();
        if (r.error) return json({ error: r.error.message }, 500);
        if (!r.data) return json({ error: "Unknown member" }, 404);

        return json({
          ok: true,
          data: {
            ig_name: r.data.ig_name,
            grade: r.data.current_grade,
            arrival_date: r.data.arrival_date,
            messages_7d: r.data.messages_7d ?? 0,
            voice_7d_seconds: r.data.voice_7d_seconds ?? 0,
          },
        });
      },
    },
  },
});
