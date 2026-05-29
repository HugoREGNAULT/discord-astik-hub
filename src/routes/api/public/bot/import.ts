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

        // Fetch current totals for all touched members
        const ids = Array.from(counts.keys());
        const { data: members, error: eRead } = await db
          .from("members")
          .select("discord_id, messages_total")
          .in("discord_id", ids);
        if (eRead) return json({ error: eRead.message }, 500);

        const totals = new Map(members?.map((m) => [m.discord_id, m.messages_total ?? 0]) ?? []);

        // Update one by one (Supabase has no bulk-conditional-update)
        let updated = 0;
        let skipped = 0;
        for (const [discord_id, inc] of counts) {
          if (!totals.has(discord_id)) {
            skipped++;
            continue;
          }
          const next = (totals.get(discord_id) ?? 0) + inc;
          const { error } = await db
            .from("members")
            .update({ messages_total: next })
            .eq("discord_id", discord_id);
          if (!error) updated++;
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
