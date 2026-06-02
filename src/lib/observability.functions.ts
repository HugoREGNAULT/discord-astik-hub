/**
 * Server function fine pour reporter une erreur côté client vers Discord.
 * Le bot token n'est JAMAIS exposé : la logique vit dans observability.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reportError } from "@/lib/observability.server";
import { db } from "@/lib/db.server";
import { getSessionData } from "@/lib/auth/session.server";

const schema = z.object({
  context: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  stack: z.string().max(4000).optional(),
});

export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }) => {
    const err = new Error(data.message || data.name || "client error");
    if (data.stack) err.stack = data.stack;
    if (data.name) err.name = data.name;
    reportError(data.context, err);

    // Persiste aussi le crash dans la table `logs` (visible sur la page staff /logs,
    // filtre niveau "error") — diagnostic sans dépendre d'un salon Discord optionnel
    // ni de la console du navigateur du visiteur.
    try {
      const session = await getSessionData();
      await db.from("logs").insert({
        level: "error",
        action: "client_error",
        actor_discord_id: session?.discordId ?? null,
        payload: {
          context: data.context,
          name: data.name ?? null,
          message: data.message ?? null,
          stack: (data.stack ?? "").slice(0, 4000),
        } as never,
      });
    } catch {
      /* fire-and-forget : ne jamais casser le report d'erreur */
    }

    return { ok: true };
  });
