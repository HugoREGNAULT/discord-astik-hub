/**
 * Hook public déclenché par pg_cron (toutes les heures à h:17).
 *
 * 1. Lance scanAnomalies() (détection statistique pure, pas d'IA).
 * 2. Pour chaque flag med/high sans ai_explanation, demande à Lovable AI
 *    Gateway une explication FR factuelle (2-3 phrases) et la persiste.
 *
 * Auth : header `x-bot-key` (BOT_API_KEY) — pattern generate-digest.ts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { _runAnomalyScan } from "@/lib/data/anomaly.functions";
import { db } from "@/lib/db.server";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT =
  "Tu es un analyste anti-triche pour une faction Minecraft. Explique en 2-3 phrases FR, " +
  "factuelles, pourquoi ce signalement mérite un œil humain, sans accuser ni conclure. " +
  "N'utilise pas de formules définitives comme « triche » ou « farm » : reste descriptif " +
  "(« écart inhabituel », « pattern à vérifier »).";

async function explainPendingFlags(): Promise<{ explained: number; skipped: number }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("scan-anomalies: LOVABLE_API_KEY missing, skipping IA explanations");
    return { explained: 0, skipped: 0 };
  }

  const { data: pending } = await db
    .from("anomaly_flags")
    .select("id, kind, severity, evidence")
    .eq("status", "open")
    .in("severity", ["med", "high"])
    .is("ai_explanation", null)
    .limit(25);

  if (!pending || pending.length === 0) return { explained: 0, skipped: 0 };

  let explained = 0;
  let skipped = 0;

  for (const flag of pending) {
    const userPrompt = `Type de signalement: ${flag.kind}\nSévérité: ${flag.severity}\nDonnées brutes:\n\`\`\`json\n${JSON.stringify(flag.evidence, null, 2)}\n\`\`\``;

    let aiResponse: Response;
    try {
      aiResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } catch (err) {
      console.error("scan-anomalies: ai gateway fetch failed", err);
      skipped += 1;
      continue;
    }

    if (!aiResponse.ok) {
      const body = await aiResponse.text().catch(() => "");
      console.error("scan-anomalies: ai gateway error", aiResponse.status, body);
      skipped += 1;
      // 402 = credits, 429 = rate limit — on arrête net pour ne pas spammer
      if (aiResponse.status === 402 || aiResponse.status === 429) break;
      continue;
    }

    const aiJson = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = aiJson.choices?.[0]?.message?.content?.trim();
    if (!content) {
      skipped += 1;
      continue;
    }

    // Idempotent : on n'écrit que si toujours NULL.
    await db
      .from("anomaly_flags")
      .update({ ai_explanation: content })
      .eq("id", flag.id)
      .is("ai_explanation", null);
    explained += 1;
  }

  return { explained, skipped };
}

export const Route = createFileRoute("/api/public/hooks/scan-anomalies")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const scan = await _runAnomalyScan();
          const ai = await explainPendingFlags();
          return Response.json({ ok: true, scan, ai });
        } catch (err) {
          console.error("scan-anomalies failed", err);
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
