/**
 * Hook bot Discord : confirmation finale d'une liaison MC ↔ Discord.
 *
 * Appelé par le bot F2 quand un membre poste `!link <CODE>` dans le salon
 * de vérification. Auth via header `x-bot-key` (BOT_API_KEY).
 *
 * Sécurité :
 *   - Aucune action côté client ne peut déclencher cette route.
 *   - On vérifie que { discordId, code } correspond à un challenge `pending`
 *     non expiré APPARTENANT à ce discordId.
 *   - Le bot ne choisit PAS le mc_uuid : celui-ci a été figé à startMcLink
 *     depuis Mojang. Le bot ne fait qu'attester la possession du compte
 *     Discord.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireBotAuth, json } from "@/lib/bot-auth.server";
import { _botConfirmMcLink } from "@/lib/data/mc-link.functions";

const schema = z.object({
  discordId: z.string().regex(/^\d{15,25}$/),
  code: z.string().min(4).max(12),
});

export const Route = createFileRoute("/api/public/bot/mc-link-confirm")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return json({ ok: false, error: "Invalid payload" }, 400);
        }

        try {
          const result = await _botConfirmMcLink(parsed.data.discordId, parsed.data.code);
          if (!result.ok) {
            return json({ ok: false, reason: result.reason }, 200);
          }
          return json({ ok: true, mc_uuid: result.mc_uuid });
        } catch (err) {
          console.error("mc-link-confirm failed", err);
          return json({ ok: false, error: "internal" }, 500);
        }
      },
    },
  },
});
