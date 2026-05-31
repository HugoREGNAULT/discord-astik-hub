import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";

// Bulk import of historical message timestamps.
// The bot already filters out members no longer on the guild before calling.
// Aggregates message counts per discord_id and increments lifetime totals.
const schema = z.object({
  entries: z
    .array(
      z.object({
        discord_id: z.string().min(1).max(64),
        // Optional timestamp — currently unused server-side but accepted for forward-compat.
        timestamp: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(50_000),
});

export const Route = createFileRoute("/api/public/bot/import")({
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

        // Count messages per discord_id
        const counts = new Map<string, number>();
        for (const e of parsed.data.entries) {
          counts.set(e.discord_id, (counts.get(e.discord_id) ?? 0) + 1);
        }

        // Increment atomique par membre via RPC (évite la race condition).
        // Si la fonction retourne NULL, le membre n'existe pas → skipped.
        let updated = 0;
        let skipped = 0;
        for (const [discord_id, inc] of counts) {
          const { data: newTotal, error } = await db.rpc("increment_messages_total", {
            p_discord_id: discord_id,
            p_inc: inc,
          });
          if (error) continue;
          if (newTotal === null || newTotal === undefined) {
            skipped++;
            continue;
          }
          updated++;
        }

        return json({
          ok: true,
          updated,
          skipped,
          distinct_members: counts.size,
          total_entries: parsed.data.entries.length,
        });
      },
    },
  },
});
