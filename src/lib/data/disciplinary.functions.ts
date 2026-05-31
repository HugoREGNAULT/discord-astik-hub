/**
 * Synthèse NEUTRE de l'historique disciplinaire d'un membre pour le staff.
 *
 * L'IA :
 *  - résume les faits, leur fréquence, l'évolution dans le temps,
 *  - ne recommande AUCUNE sanction,
 *  - ne juge pas,
 *  - n'écrit jamais à la place du staff.
 *
 * La création d'un warning reste manuelle (cf. members.functions.ts /
 * MemberWarningsPanel). Cette fonction ne fait que LIRE.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const inputSchema = z.object({
  discordId: z.string().trim().regex(/^\d{15,25}$/),
});

interface RawWarning {
  id: string;
  body: string | null;
  staff_username: string | null;
  created_at: string;
}
interface RawNote {
  id: string;
  body: string | null;
  staff_username: string | null;
  created_at: string;
}

export interface DisciplinarySummary {
  summary: string;
  model: string;
  sources: {
    warnings: RawWarning[];
    notes: RawNote[];
  };
  counts: {
    warnings: number;
    notes: number;
  };
}

export const summarizeDisciplinary = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<DisciplinarySummary> => {
    await requirePermission("warnings.view");

    const [warningsRes, notesRes] = await Promise.all([
      db
        .from("warnings")
        .select("id, body, staff_username, created_at")
        .eq("member_discord_id", data.discordId)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("notes")
        .select("id, body, staff_username, created_at")
        .eq("member_discord_id", data.discordId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (warningsRes.error) throw new Error(warningsRes.error.message);
    if (notesRes.error) throw new Error(notesRes.error.message);

    const warnings = (warningsRes.data ?? []) as RawWarning[];
    const notes = (notesRes.data ?? []) as RawNote[];

    if (warnings.length === 0 && notes.length === 0) {
      return {
        summary: "_Aucun avertissement ni note enregistré pour ce membre._",
        model: DEFAULT_MODEL,
        sources: { warnings, notes },
        counts: { warnings: 0, notes: 0 },
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const payload = {
      warnings: warnings.map((w) => ({
        date: w.created_at.slice(0, 10),
        staff: w.staff_username ?? "—",
        body: (w.body ?? "").slice(0, 600),
      })),
      notes: notes.map((n) => ({
        date: n.created_at.slice(0, 10),
        staff: n.staff_username ?? "—",
        body: (n.body ?? "").slice(0, 600),
      })),
    };

    const systemPrompt = `Tu résumes NEUTREMENT l'historique disciplinaire d'un membre pour aider le staff à décider. Tu ne RECOMMANDES PAS de sanction, tu ne juges pas, tu ne qualifies pas le membre ("toxique", "récidiviste", etc.). Liste factuellement les faits et leur fréquence.

Format markdown attendu, en français, 200 mots max :

**Vue d'ensemble** : 1-2 phrases factuelles (nombre de warnings, période couverte).

**Thématiques récurrentes** : liste à puces des sujets qui reviennent (ex : "retards en event x3", "manque de comm x2"). Si rien ne se répète, écris "Pas de thématique récurrente".

**Évolution dans le temps** : phrase neutre sur la fréquence (en hausse, stable, isolé, ancien…).

**Notes complémentaires** : 1-2 puces si les notes apportent un contexte utile, sinon "RAS".

Termine TOUJOURS par la ligne exacte :
*Résumé indicatif — toute sanction reste une décision humaine.*`;

    const userPrompt = `Historique brut du membre (anonymisé côté staff) :\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

    let res: Response;
    try {
      res = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } catch (err) {
      console.error("disciplinary: gateway fetch failed", err);
      throw new Error("AI gateway unreachable");
    }

    if (res.status === 429) throw new Error("AI gateway rate-limited.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) {
      const body = await res.text();
      console.error("disciplinary: gateway error", res.status, body);
      throw new Error(`AI gateway error ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const summary = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!summary) throw new Error("Réponse IA vide");

    return {
      summary,
      model: DEFAULT_MODEL,
      sources: { warnings, notes },
      counts: { warnings: warnings.length, notes: notes.length },
    };
  });
