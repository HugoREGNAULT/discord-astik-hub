import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { previewSalaryRunForCron } from "@/lib/data/salary.functions";

/**
 * Hook public déclenché par pg_cron (lundi 12h).
 * Génère UNIQUEMENT l'aperçu des salaires de la semaine écoulée (lun→dim).
 * Le versement reste manuel (staff sur /salaries).
 *
 * Auth : header `x-bot-key` (BOT_API_KEY).
 */
function lastWeekRange(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  // JS: 0=Sunday, 1=Monday … 6=Saturday. On veut lundi→dimanche de la semaine PASSÉE.
  const day = now.getUTCDay(); // 0..6
  // Days since last Monday (this week)
  const sinceThisMon = (day + 6) % 7;
  const thisMon = new Date(now);
  thisMon.setUTCDate(now.getUTCDate() - sinceThisMon);
  const lastMon = new Date(thisMon);
  lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(lastMon);
  lastSun.setUTCDate(lastMon.getUTCDate() + 6);
  return {
    periodStart: lastMon.toISOString().slice(0, 10),
    periodEnd: lastSun.toISOString().slice(0, 10),
  };
}

export const Route = createFileRoute("/api/public/hooks/generate-salary-preview")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const { periodStart, periodEnd } = lastWeekRange();
          const result = await previewSalaryRunForCron(periodStart, periodEnd);
          return Response.json({
            ok: true,
            periodStart,
            periodEnd,
            total: result.total,
            recipients: result.recipients,
            runId: (result.run as { id: string } | null)?.id ?? null,
          });
        } catch (err) {
          console.error("generate-salary-preview failed", err);
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
