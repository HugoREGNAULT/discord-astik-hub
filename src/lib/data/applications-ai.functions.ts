/**
 * Avis IA sur une candidature PunkAstik.
 *
 * Pipeline en 2 temps :
 *   1. Enrichissement (Mojang → UUID, Paladium profil + jobs, blacklist, alts).
 *      Toléranct aux erreurs Paladium (429/5xx ne font JAMAIS échouer la review).
 *   2. Synthèse IA via Lovable AI Gateway (Gemini Flash) — JSON strict
 *      {score, fit, strengths, concerns}.
 *
 * Le résultat (evidence + synthèse + meta) est stocké dans
 * applications.ai_review (jsonb). Idempotent : si déjà présent et !force,
 * on renvoie le résultat existant sans rappeler l'IA.
 *
 * L'avis est INDICATIF — aucune décision n'est prise automatiquement.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `Tu es recruteur adjoint de la faction PunkAstik (Paladium, PVP Faction Moddé). À partir des données candidat (présentations IRL + Minecraft/Paladium, âge, dispos, objectifs, motivation, niveau PvP auto-déclaré, stats Paladium, blacklist, alts), donne un avis FACTUEL et nuancé : un score d'adéquation 0-100, 2-3 forces, 2-3 points de vigilance, ET 2-3 questions de relance à poser en entretien, personnalisées au profil (ex. cite son grade IG shop, ses métiers Paladium principaux, son ancienne faction, une incohérence repérée, etc. — pas de questions génériques). Tu ne DÉCIDES pas, tu conseilles. Si le candidat est mineur, reste neutre et ne stocke aucune donnée superflue. Réponds en JSON strict {score, fit, strengths[], concerns[], followup_questions[]} (fit ∈ {"plutot_oui","a_creuser","plutot_non"}, strengths/concerns = 2-3 phrases courtes, followup_questions = 2-3 questions courtes adressées au candidat).`;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

type Evidence = {
  mc_uuid: string | null;
  mojang_error?: string;
  paladium_profile: JsonValue;
  paladium_jobs: JsonValue;
  paladium_error?: string;
  blacklist_matches: Array<{
    matched_on: string[];
    reason: string;
    added_by_username: string | null;
    created_at: string;
  }>;
  alt_signals: Array<{
    member_discord_id: string;
    alt_discord_id: string | null;
    alt_name: string | null;
    matched_on: string;
  }>;
};

function toJson(value: unknown): JsonValue {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return null;
  }
}

type AiSynth = {
  score: number;
  fit: "plutot_oui" | "a_creuser" | "plutot_non" | string;
  strengths: string[];
  concerns: string[];
  followup_questions: string[];
};

export type ApplicationAiReview = {
  evidence: Evidence;
  ai: AiSynth | null;
  ai_error?: string;
  model: string;
  generated_at: string;
};

async function fetchMojangUuid(name: string): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string; name?: string };
    if (!body.id || !body.name) return null;
    return { id: body.id, name: body.name };
  } catch {
    return null;
  }
}

/**
 * Runner réutilisable (cron, hook, fire-and-forget) sans contrôle de permissions.
 * NE PAS exposer directement à des callers non authentifiés — passer par
 * `reviewApplication` (UI) ou par le hook `/api/public/hooks/process-application-reviews`
 * (gated by BOT_API_KEY).
 */
export async function _runReviewApplication(
  applicationId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; reused?: boolean; review?: ApplicationAiReview; error?: string }> {
  const [{ db }, { findBlacklistMatches }, { fetchPaladium }] = await Promise.all([
    import("@/lib/db.server"),
    import("@/lib/data/blacklist.server"),
    import("@/lib/paladium/paladium.server"),
  ]);

  const { data: app, error } = await db
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!app) return { ok: false, error: "Candidature introuvable" };

  // Idempotence : si déjà généré et !force, renvoie tel quel.
  if (!opts.force && app.ai_review) {
    return { ok: true, reused: true, review: app.ai_review as ApplicationAiReview };
  }

  // 1) Mojang
  const mojang = await fetchMojangUuid(app.mc_name);

  // 2) Paladium (try/catch tolérant — on n'échoue JAMAIS la review pour ça)
  //    L'API Paladium accepte uuid OU username sur /player/profile/{uuid|username}.
  //    Certains UUID retournent 404 alors que le pseudo fonctionne (et inversement,
  //    ex. pseudo changé récemment). On essaye donc uuid puis fallback username.
  let paladiumProfile: unknown | null = null;
  let paladiumJobs: unknown | null = null;
  let paladiumError: string | undefined;

  const candidates = [mojang?.id, app.mc_name].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  for (const id of candidates) {
    try {
      const profileRes = await fetchPaladium(
        `/v1/paladium/player/profile/${encodeURIComponent(id)}`,
      );
      paladiumProfile = profileRes.data ?? null;
      paladiumError = undefined;
      break;
    } catch (err) {
      paladiumError = err instanceof Error ? err.message : "paladium profile failed";
    }
  }

  // Jobs endpoint : 404 = joueur n'a jamais joué (pas de métiers) → on ignore
  // silencieusement. On ne remonte une erreur que si tous les essais échouent
  // sans aucun 404 (ex. 429/5xx réel).
  if (paladiumProfile) {
    const jobsErrors: string[] = [];
    let sawNotFound = false;
    for (const id of candidates) {
      try {
        const jobsRes = await fetchPaladium(
          `/v1/paladium/player/profile/${encodeURIComponent(id)}/jobs`,
        );
        paladiumJobs = jobsRes.data ?? null;
        sawNotFound = false;
        jobsErrors.length = 0;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "paladium jobs failed";
        if (/\b404\b/.test(msg)) sawNotFound = true;
        jobsErrors.push(msg);
      }
    }
    if (!paladiumJobs && jobsErrors.length > 0 && !sawNotFound) {
      paladiumError = (paladiumError ? paladiumError + " | " : "") + jobsErrors.join(" | ");
    }
  }

  // 3) Blacklist
  const matches = await findBlacklistMatches({
    discordId: app.discord_id,
    mcName: app.mc_name,
    mcUuid: mojang?.id ?? undefined,
  });

  // 4) Alts (même discord_id ou mc_name déjà lié dans member_alts)
  const altSignals: Evidence["alt_signals"] = [];
  try {
    const filters: string[] = [];
    if (app.discord_id) filters.push(`alt_discord_id.eq.${app.discord_id}`);
    if (app.mc_name) filters.push(`alt_name.ilike.${app.mc_name}`);
    if (filters.length > 0) {
      const { data: alts } = await db
        .from("member_alts")
        .select("member_discord_id, alt_discord_id, alt_name")
        .or(filters.join(","));
      for (const a of alts ?? []) {
        const matched =
          a.alt_discord_id === app.discord_id
            ? "discord_id"
            : (a.alt_name ?? "").toLowerCase() === app.mc_name.toLowerCase()
              ? "mc_name"
              : "other";
        altSignals.push({
          member_discord_id: a.member_discord_id,
          alt_discord_id: a.alt_discord_id,
          alt_name: a.alt_name,
          matched_on: matched,
        });
      }
    }
  } catch {
    /* ignore */
  }

  const evidence: Evidence = {
    mc_uuid: mojang?.id ?? null,
    mojang_error: mojang ? undefined : "uuid_unresolved",
    paladium_profile: toJson(paladiumProfile),
    paladium_jobs: toJson(paladiumJobs),
    paladium_error: paladiumError,
    blacklist_matches: matches.map((m) => ({
      matched_on: m.matched_on,
      reason: m.reason,
      added_by_username: m.added_by_username,
      created_at: m.created_at,
    })),
    alt_signals: altSignals,
  };

  // 5) Synthèse IA
  const apiKey = process.env.LOVABLE_API_KEY;
  let ai: AiSynth | null = null;
  let aiError: string | undefined;

  if (!apiKey) {
    aiError = "LOVABLE_API_KEY missing";
  } else {
    const isMinor = app.age != null && app.age < 15;
    // Présentations tronquées pour les mineurs (RGPD : minimisation).
    const trunc = (s: string | null) => (isMinor ? (s ?? "").slice(0, 400) : (s ?? ""));
    const userPayload = {
      candidat: {
        pseudo_mc: app.mc_name,
        discord: app.discord_username,
        age: app.age,
        pays: app.country,
        a_connu_via: app.heard_from,
        disponibilites: app.schedule,
        objectifs: app.objectives,
        niveau_pvp_autodeclare: app.pvp_level,
        presentation_irl: trunc(app.presentation),
        presentation_minecraft_paladium: trunc(app.presentation_gaming),
        motivation: app.motivation,
        infos_complementaires: app.additional_info ?? null,
      },
      evidence,
    };

    try {
      const res = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(userPayload) },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (res.status === 429) aiError = "AI rate-limited";
      else if (res.status === 402) aiError = "AI credits exhausted";
      else if (!res.ok) {
        const body = await res.text();
        aiError = `AI ${res.status}: ${body.slice(0, 200)}`;
      } else {
        const j = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = j.choices?.[0]?.message?.content?.trim();
        if (content) {
          try {
            const parsed = JSON.parse(content);
            ai = {
              score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
              fit: String(parsed.fit ?? "a_creuser"),
              strengths: Array.isArray(parsed.strengths)
                ? parsed.strengths.slice(0, 5).map(String)
                : [],
              concerns: Array.isArray(parsed.concerns)
                ? parsed.concerns.slice(0, 5).map(String)
                : [],
              followup_questions: Array.isArray(parsed.followup_questions)
                ? parsed.followup_questions.slice(0, 5).map(String)
                : Array.isArray(parsed.questions)
                  ? parsed.questions.slice(0, 5).map(String)
                  : [],
            };
          } catch {
            aiError = "AI response not JSON";
          }
        } else {
          aiError = "AI response empty";
        }
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : "AI fetch failed";
    }
  }

  const review: ApplicationAiReview = {
    evidence,
    ai,
    ai_error: aiError,
    model: MODEL,
    generated_at: new Date().toISOString(),
  };

  const upd = await db
    .from("applications")
    .update({ ai_review: review as never })
    .eq("id", applicationId);
  if (upd.error) return { ok: false, error: upd.error.message };

  return { ok: true, review };
}

/**
 * Server function appelée depuis l'UI staff. Gated by recruit.access.
 * Force = true régénère même si ai_review déjà présent.
 */
export const reviewApplication = createServerFn({ method: "POST" })
  .inputValidator((d: { applicationId: string; force?: boolean }) =>
    z.object({ applicationId: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requirePermission, logAction } = await import("@/lib/auth/require.server");
    const staff = await requirePermission("recruit.access");
    const res = await _runReviewApplication(data.applicationId, { force: data.force });
    if (!res.ok) throw new Error(res.error ?? "Review failed");
    if (!res.reused) {
      await logAction("application_ai_review", staff.discordId, {
        application_id: data.applicationId,
        force: !!data.force,
        had_ai: !!res.review?.ai,
      });
    }
    return { ok: true, reused: !!res.reused, review: res.review ?? null };
  });

/**
 * Récupère l'ai_review déjà stocké (lecture seule, pour l'UI staff).
 */
export const getApplicationAiReview = createServerFn({ method: "GET" })
  .inputValidator((d: { applicationId: string }) =>
    z.object({ applicationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requirePermission } = await import("@/lib/auth/require.server");
    const { db } = await import("@/lib/db.server");
    await requirePermission("recruit.access");
    const { data: row, error } = await db
      .from("applications")
      .select("ai_review")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row?.ai_review as ApplicationAiReview | null) ?? null;
  });
