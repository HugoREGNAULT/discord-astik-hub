/**
 * Server function fine pour reporter une erreur côté client vers Discord.
 * Le bot token n'est JAMAIS exposé : la logique vit dans observability.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reportError } from "@/lib/observability.server";

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
    return { ok: true };
  });
