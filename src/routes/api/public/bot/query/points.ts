import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { botUserFromPayload, BotPermissionError } from "@/lib/bot-permissions.server";
import { canAccess } from "@/lib/auth/permissions";

const schema = z.object({
  discord_id: z.string().min(1).max(64),
  actor_discord_id: z.string().min(1).max(64),
  actor_role_ids: z.array(z.string()).max(200),
});

export const Route = createFileRoute("/api/public/bot/query/points")({
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

        try {
          const m = await db
            .from("members")
            .select("discord_id, ig_name, astik_points")
            .eq("discord_id", discord_id)
            .maybeSingle();
          if (m.error) return json({ error: m.error.message }, 500);
          if (!m.data) return json({ error: "Unknown member" }, 404);

          const ledger = await db
            .from("points_ledger")
            .select("id, amount, reason, action_type, total_after, bonus_pct, staff_username, created_at")
            .eq("member_discord_id", discord_id)
            .order("created_at", { ascending: false })
            .limit(5);
          if (ledger.error) return json({ error: ledger.error.message }, 500);

          return json({
            ok: true,
            data: {
              discord_id: m.data.discord_id,
              ig_name: m.data.ig_name,
              astik_points: m.data.astik_points ?? 0,
              ledger: ledger.data ?? [],
            },
          });
        } catch (e) {
          if (e instanceof BotPermissionError) return json({ error: "Forbidden" }, 403);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
