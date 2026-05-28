/**
 * POST /api/auth/logout — clears session and redirects to /.
 * Also accepts GET for convenience.
 */
import { createFileRoute } from "@tanstack/react-router";
import { clearSessionData } from "@/lib/auth/session.server";

async function handler() {
  await clearSessionData();
  return new Response(null, { status: 302, headers: { Location: "/" } });
}

export const Route = createFileRoute("/api/auth/logout")({
  server: { handlers: { GET: handler, POST: handler } },
});
