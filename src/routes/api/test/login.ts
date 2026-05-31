/**
 * POST /api/test/login — endpoint réservé aux tests E2E.
 * Crée une session authentifiée pour un utilisateur staff fictif.
 * Désactivé en production.
 */
import { createFileRoute } from "@tanstack/react-router";
import { setSessionData } from "@/lib/auth/session.server";
import { db } from "@/lib/db.server";
import { ROLES } from "@/lib/discord/constants";

const TEST_DISCORD_ID = "e2e-test-staff-001";

export const Route = createFileRoute("/api/test/login")({
  server: {
    handlers: {
      POST: async () => {
        if (!import.meta.env.DEV || process.env.NODE_ENV === "production") {
          return new Response("Not found", { status: 404 });
        }

        const now = Date.now();
        const roleIds = [ROLES.STAFF_FACTION, ROLES.MEMBER_FACTION];

        await db.from("members").upsert(
          {
            discord_id: TEST_DISCORD_ID,
            discord_username: "E2EStaff",
            status: "active",
          },
          { onConflict: "discord_id" },
        );

        await setSessionData({
          discordId: TEST_DISCORD_ID,
          username: "E2EStaff",
          globalName: "E2E Staff User",
          avatar: null,
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          expiresAt: now + 60 * 60 * 1000,
          roleIds,
          rolesRefreshedAt: now,
        });

        return new Response(null, { status: 302, headers: { Location: "/polls" } });
      },
    },
  },
});
