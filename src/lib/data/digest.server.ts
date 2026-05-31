/**
 * Génération du résumé IA hebdo de l'activité faction.
 *
 * 1. Récolte des stats des 7 derniers jours (membres, points, donations,
 *    candidatures, sanctions, top contributeurs, etc.)
 * 2. Envoi à Lovable AI Gateway (Gemini Flash) avec un prompt structuré
 * 3. Enregistrement dans la table `ai_digests` (idempotent par `week_start`)
 *
 * Appelé par :
 *  - le cron Supabase (lundi 10h via /api/public/hooks/generate-digest)
 *  - manuellement par un admin via `generateDigestManually`
 */

import { db } from "@/lib/db.server";
import { filterFactionMembers } from "@/lib/data/faction-members";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

/** Renvoie le lundi (UTC) de la semaine d'une date donnée, au format YYYY-MM-DD. */
function mondayOf(date: Date): string {
  const d = new Date(date.getTime());
  const day = d.getUTCDay(); // 0=dim, 1=lun, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export interface DigestResult {
  ok: boolean;
  reused?: boolean;
  week_start: string;
  id?: string;
  summary?: string;
  error?: string;
}

interface GenerateOptions {
  generatedBy?: string;
  /** Force re-generate even if a digest already exists for this week. */
  force?: boolean;
}

export async function generateWeeklyDigest(opts: GenerateOptions = {}): Promise<DigestResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      week_start: mondayOf(new Date()),
      error: "LOVABLE_API_KEY missing",
    };
  }

  const generatedBy = opts.generatedBy ?? "cron";
  const now = new Date();
  // On résume la semaine PRÉCÉDENTE : si on tourne lundi matin, on raconte
  // ce qui s'est passé de lundi dernier à dimanche soir.
  const lastWeekRef = new Date(now.getTime() - 7 * 86_400_000);
  const weekStart = mondayOf(lastWeekRef);
  const weekStartIso = `${weekStart}T00:00:00Z`;
  const weekEndIso = new Date(new Date(weekStartIso).getTime() + 7 * 86_400_000).toISOString();

  // Idempotence
  if (!opts.force) {
    const { data: existing } = await db
      .from("ai_digests")
      .select("id, summary")
      .eq("week_start", weekStart)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        reused: true,
        week_start: weekStart,
        id: existing.id,
        summary: existing.summary ?? undefined,
      };
    }
  }

  // 1. Collecte stats
  const [
    activeMembers,
    arrivals,
    departures,
    applications,
    donations,
    warnings,
    pointsLedger,
    logs,
  ] = await Promise.all([
    db
      .from("members")
      .select("discord_id, ig_name, current_grade, arrival_date, mc_uuid")
      .eq("status", "active"),
    db
      .from("members")
       .select("discord_id, ig_name, discord_username, arrival_date, recruiter_discord_id, current_grade, mc_uuid")
      .gte("arrival_date", weekStart)
      .lt("arrival_date", weekEndIso.slice(0, 10)),
    db
      .from("members")
       .select("discord_id, ig_name, discord_username, updated_at, current_grade, arrival_date, mc_uuid")
      .eq("status", "former")
      .gte("updated_at", weekStartIso)
      .lt("updated_at", weekEndIso),
    db
      .from("applications")
      .select("status, discord_username, mc_name, created_at, decided_at")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso),
    db
      .from("donations")
      .select("status, total_final, member_discord_id, created_at")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso),
    db
      .from("warnings")
      .select("member_discord_id, staff_username, body, created_at")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso),
    db
      .from("points_ledger")
      .select("member_discord_id, amount, action_type")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso),
    db
      .from("logs")
      .select("action, actor_discord_id, level")
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso)
      .limit(2000),
  ]);

  // Agrégats
   const factionActiveMembers = filterFactionMembers(activeMembers.data ?? []);
   const factionArrivals = filterFactionMembers(arrivals.data ?? []);
   const factionDepartures = filterFactionMembers(departures.data ?? []);
   const apps = applications.data ?? [];
  const accepted = apps.filter((a) => a.status === "accepted").length;
  const rejected = apps.filter((a) => a.status === "rejected").length;
  const pending = apps.filter((a) => a.status === "pending").length;

  const donationsList = donations.data ?? [];
  const totalDonations = donationsList
    .filter((d) => d.status === "validated")
    .reduce((acc: number, d) => acc + (d.total_final ?? 0), 0);
  const cancelledDonations = donationsList.filter((d) => d.status === "cancelled").length;

  // Top contributeurs
  const sums = new Map<string, number>();
  for (const p of pointsLedger.data ?? []) {
    if ((p.amount ?? 0) > 0) {
      sums.set(p.member_discord_id, (sums.get(p.member_discord_id) ?? 0) + p.amount);
    }
  }
  const topIds = Array.from(sums.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topContribs: Array<{ name: string; points: number }> = [];
  if (topIds.length > 0) {
    const { data: m } = await db
      .from("members")
       .select("discord_id, ig_name, discord_username, current_grade, arrival_date, mc_uuid")
      .in(
        "discord_id",
        topIds.map(([id]) => id),
      );
     const byId = new Map(filterFactionMembers(m ?? []).map((x) => [x.discord_id, x]));
     topContribs = topIds.filter(([id]) => byId.has(id)).map(([id, points]) => {
       const found = byId.get(id);
       return {
         name: found?.ig_name ?? found?.discord_username ?? id,
         points,
       };
     });
  }

  const actionsByType = new Map<string, number>();
  for (const l of logs.data ?? []) {
    actionsByType.set(l.action, (actionsByType.get(l.action) ?? 0) + 1);
  }

  // Anonymisation : pas de discord_id brut ni de texte de sanction envoyés à l'IA.
  type AnonInput = {
    ig_name?: string | null;
    discord_username?: string | null;
    current_grade?: string | null;
  };
  const anonymizeMembers = (rows: AnonInput[]) =>
    rows.map((m) => ({
      name: m.ig_name ?? m.discord_username ?? "—",
      grade: m.current_grade ?? null,
    }));

  const stats = {
    week_start: weekStart,
    week_end: weekEndIso.slice(0, 10),
    active_members: factionActiveMembers.length,
    arrivals: anonymizeMembers(factionArrivals),
    departures: anonymizeMembers(factionDepartures),
    applications: {
      total: apps.length,
      accepted,
      rejected,
      pending,
    },
    donations: {
      validated_count: donationsList.filter((d) => d.status === "validated").length,
      total_points_validated: totalDonations,
      cancelled: cancelledDonations,
    },
    warnings: {
      total: (warnings.data ?? []).length,
    },
    top_contributors: topContribs,
    staff_actions: Object.fromEntries(actionsByType),
  };


  // 2. Appel IA
  const systemPrompt = `Tu es l'historien officiel de la faction Minecraft "PunkAstik" sur le serveur Paladium. Tu rédiges un compte-rendu hebdomadaire pour le staff, en français, ton décontracté mais factuel, sans emojis excessifs (2-3 max sur tout le doc). Structure attendue en markdown :

# Semaine du <date>
**TL;DR** : 2-3 phrases qui résument l'essentiel.

## 📊 Chiffres clés
- Membres actifs, arrivées/départs, candidatures, donations

## 🌟 Highlights
- Top contributeurs, événements notables, momentum

## ⚠️ Points d'attention
- Mentionne le NOMBRE de sanctions de la semaine (champ warnings.total) sans aucun détail nominatif ni texte ; signale aussi les candidatures en attente et signaux faibles

## 💡 Suggestions staff
- 2-3 actions concrètes à envisager cette semaine

Sois concis (max 350 mots). Ne mentionne JAMAIS un membre par son discord_id brut ; utilise toujours son ig_name ou discord_username. Si une section n'a pas de data significative, écris "RAS".`;

  const userPrompt = `Voici les stats brutes de la semaine. Rédige le compte-rendu.

\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\``;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    console.error("digest: ai gateway fetch failed", err);
    return {
      ok: false,
      week_start: weekStart,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }

  if (!aiResponse.ok) {
    const body = await aiResponse.text();
    console.error("digest: ai gateway error", aiResponse.status, body);
    return {
      ok: false,
      week_start: weekStart,
      error: `AI gateway ${aiResponse.status}`,
    };
  }

  const aiJson = (await aiResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = aiJson.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { ok: false, week_start: weekStart, error: "AI response empty" };
  }

  // 3. Extraction d'un résumé court (1ʳᵉ ligne après TL;DR ou 1ʳᵉ phrase)
  const tldrMatch = content.match(/\*\*TL;DR\*\*\s*[:\-–]\s*([^\n]+)/i);
  const summary = (
    tldrMatch?.[1] ??
    content
      .split("\n")
      .find((l) => l.trim())
      ?.slice(0, 240) ??
    ""
  )
    .trim()
    .slice(0, 280);

  const { data: inserted, error: insertError } = await db
    .from("ai_digests")
    .upsert(
      {
        week_start: weekStart,
        content,
        summary,
        model: DEFAULT_MODEL,
        meta: stats as never,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "week_start" },
    )
    .select("id")
    .single();

  if (insertError) {
    console.error("digest: insert failed", insertError);
    return { ok: false, week_start: weekStart, error: insertError.message };
  }

  return {
    ok: true,
    week_start: weekStart,
    id: inserted?.id,
    summary,
  };
}
