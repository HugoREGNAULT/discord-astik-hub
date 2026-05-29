/**
 * Avis IA sur une candidature PunkAstik (Paladium, PVP Faction Moddé).
 * Génère à la demande un récap + analyse + questions d'entretien.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export const reviewApplication = createServerFn({ method: "POST" })
  .inputValidator((d: { applicationId: string }) =>
    z.object({ applicationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("recruit.access");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquante");

    const { data: app, error } = await db
      .from("applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("Candidature introuvable");

    const { findBlacklistMatches } = await import("@/lib/data/blacklist.server");
    const blacklist = await findBlacklistMatches({
      discordId: app.discord_id,
      mcName: app.mc_name,
    });

    const systemPrompt = `Tu es un recruteur senior pour la faction PunkAstik sur Paladium (serveur Minecraft français PVP Faction Moddé : raids, farm, économie joueur, conflits inter-factions, donations en items, grades shop Héros/Légende/Divinité).

Tu analyses une candidature pour aider les recruteurs à décider. Ton décontracté, direct, sans bullshit. Français. Markdown.

Structure attendue :

## Récap express
2-3 phrases qui résument le profil.

## Points forts
Liste à puces — ce qui plaide pour.

## Points d'attention / red flags
Liste à puces — incohérences, manque d'XP PVP/faction, dispo douteuse, présentation bâclée, grade shop suspect vs ancienneté annoncée, etc. Si rien : "RAS".

## Avis global
Une recommandation claire : **Plutôt OUI**, **À creuser en entretien**, ou **Plutôt NON**, + 1 phrase de justification.

## Questions à poser en entretien
4 à 6 questions ciblées, spécifiques à CE candidat (pas génériques) et au contexte Paladium PVP Faction Moddé. Couvre : expérience PVP réelle, gestion de raid/défense, comportement en conflit, fiabilité/dispo, motivation à rejoindre PunkAstik vs autre faction.

Reste sous 350 mots. N'invente pas d'infos absentes ; signale-le si la présentation est trop courte ou vague.`;

    const userPrompt = `Candidature à analyser :

\`\`\`json
${JSON.stringify(
  {
    pseudo_mc: app.mc_name,
    discord: app.discord_username,
    age: app.age,
    pays: app.country,
    grade_ig_shop: app.ig_grade,
    premiere_version: app.first_version,
    horaires: app.schedule,
    temps_jeu_semaine: app.weekly_playtime,
    niveau_connaissance_paladium_sur_10: app.knowledge_level,
    competences: app.skills,
    anciennes_factions: app.previous_factions || "(non renseigné)",
    a_connu_via: app.heard_from,
    presentation: app.presentation,
    blacklist_matches: blacklist.length
      ? blacklist.map((m) => ({ raison: m.reason, par: m.added_by_username }))
      : "aucun",
  },
  null,
  2,
)}
\`\`\``;

    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes IA, réessaie dans un instant.");
    if (res.status === 402)
      throw new Error("Crédits IA épuisés — ajoute des crédits à l'espace Lovable.");
    if (!res.ok) {
      const body = await res.text();
      console.error("reviewApplication AI error", res.status, body);
      throw new Error(`Erreur IA (${res.status})`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Réponse IA vide");
    return { content };
  });
