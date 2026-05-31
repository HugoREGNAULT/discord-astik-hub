import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { requireBotPermission, BotPermissionError } from "@/lib/bot-permissions.server";
import { validateDonationCart } from "@/lib/data/donations.server";

const schema = z.object({
  donation_id: z.string().uuid(),
  actor_discord_id: z.string().min(1).max(64),
  actor_role_ids: z.array(z.string()).max(200),
});

export const Route = createFileRoute("/api/public/bot/query/don-valider")({
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
        const { donation_id, actor_discord_id, actor_role_ids } = parsed.data;

        try {
          requireBotPermission(actor_role_ids, "donations.manage");
        } catch (e) {
          if (e instanceof BotPermissionError) return json({ error: "Forbidden" }, 403);
          throw e;
        }

        try {
          const result = await validateDonationCart(
            donation_id,
            { discordId: actor_discord_id, username: "bot" },
            "bot",
          );
          return json({ ok: true, data: result });
        } catch (e) {
          return json({ error: (e as Error).message }, 400);
        }
      },
    },
  },
});
