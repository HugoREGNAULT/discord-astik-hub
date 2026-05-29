/**
 * POST /api/test/seed-poll — endpoint réservé aux tests E2E.
 * Crée un sondage de test avec 2 créneaux et renvoie son ID.
 * Désactivé en production.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/lib/db.server";

const TEST_DISCORD_ID = "e2e-test-staff-001";

export const Route = createFileRoute("/api/test/seed-poll")({
  server: {
    handlers: {
      POST: async () => {
        if (process.env.NODE_ENV === "production") {
          return new Response("Not found", { status: 404 });
        }

        const now = new Date();
        const slot1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const slot2 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        const { data: poll, error: pollErr } = await db
          .from("polls")
          .insert({
            title: "Sondage E2E Test",
            description: "Sondage créé automatiquement pour les tests E2E.",
            location: "Salon vocal #test",
            status: "open",
            created_by_discord_id: TEST_DISCORD_ID,
            created_by_username: "E2EStaff",
          })
          .select()
          .single();

        if (pollErr || !poll) {
          return new Response(`Failed to create test poll: ${pollErr?.message ?? "unknown"}`, {
            status: 500,
          });
        }

        const { error: optsErr } = await db.from("poll_options").insert([
          {
            poll_id: poll.id,
            starts_at: slot1.toISOString(),
            duration_minutes: 60,
            display_order: 0,
          },
          {
            poll_id: poll.id,
            starts_at: slot2.toISOString(),
            duration_minutes: 90,
            display_order: 1,
          },
        ]);

        if (optsErr) {
          return new Response(`Failed to create poll options: ${optsErr.message}`, {
            status: 500,
          });
        }

        return Response.json({ pollId: poll.id });
      },
    },
  },
});
