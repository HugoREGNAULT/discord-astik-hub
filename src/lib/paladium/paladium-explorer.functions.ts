import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPaladiumRaw } from "./paladium.server";
import { logAction, requirePermission } from "@/lib/auth/require.server";
import { rateLimit } from "@/lib/rate-limit.server";

// Explorateur API brut (staff) : appelle un chemin Paladium arbitraire (whitelist
// de caractères ci-dessous) et renvoie status/rate/corps tels quels, sans jamais
// lever sur une erreur HTTP Paladium — seule une vraie panne applicative
// (permission, rate-limit local) lève une exception.
export const exploreRawPaladiumEndpoint = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        path: z
          .string()
          .min(1)
          .max(512)
          .regex(/^\/v1\/[A-Za-z0-9\-_./%]+(\?[A-Za-z0-9\-_./%=&]+)?$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("paladium.debug");
    const { ok } = rateLimit(`paladium-explorer:${user.discordId}`, 30, 10000);
    if (!ok) throw new Error("RATE_LIMITED");
    const result = await fetchPaladiumRaw(data.path);
    await logAction("paladium_debug_call", user.discordId, {
      path: data.path,
      status: result.status,
    });
    return { status: result.status, ok: result.ok, rate: result.rate, body: result.bodyText };
  });
