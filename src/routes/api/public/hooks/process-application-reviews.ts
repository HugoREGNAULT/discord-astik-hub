/**
 * Hook public déclenché par pg_cron (toutes les 10 minutes).
 *
 * Traite par lot les candidatures dont ai_review IS NULL :
 *   - enrichissement (Mojang/Paladium/blacklist/alts, tolérant aux erreurs)
 *   - synthèse IA (Gemini Flash via Lovable AI Gateway)
 *   - persist dans applications.ai_review
 *
 * On évite ainsi le fire-and-forget pendant la requête de soumission
 * (potentiellement coupé par le runtime Lovable).
 *
 * Auth : header `x-bot-key` (BOT_API_KEY).
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { db } from "@/lib/db.server";
import { _runReviewApplication } from "@/lib/data/applications-ai.functions";

const BATCH_SIZE = 10;

export const Route = createFileRoute("/api/public/hooks/process-application-reviews")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const { data: pending } = await db
            .from("applications")
            .select("id")
            .is("ai_review", null)
            .order("created_at", { ascending: true })
            .limit(BATCH_SIZE);

          const ids = (pending ?? []).map((r) => r.id);
          const results: Array<{ id: string; ok: boolean; error?: string }> = [];
          for (const id of ids) {
            const r = await _runReviewApplication(id, { force: false });
            results.push({ id, ok: r.ok, error: r.error });
          }
          return Response.json({ ok: true, processed: results.length, results });
        } catch (err) {
          console.error("process-application-reviews failed", err);
          return new Response(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : "unknown",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
