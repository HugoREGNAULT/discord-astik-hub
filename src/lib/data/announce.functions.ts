/**
 * Génération d'annonces assistée par IA + publication MANUELLE sur Discord.
 *
 * - generateAnnouncement : produit un brouillon markdown (ne publie rien).
 * - publishAnnouncement   : poste un texte fourni par le staff dans un salon.
 *
 * L'IA ne publie JAMAIS. Toute publication exige un clic humain via
 * publishAnnouncement().
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { postToChannel } from "@/lib/discord/log.server";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const TONES = ["officiel", "chaleureux", "concis", "solennel", "fun"] as const;

const generateSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  tone: z.enum(TONES).optional().default("officiel"),
});

const publishSchema = z.object({
  text: z.string().trim().min(2).max(4000),
  channel: z.string().trim().regex(/^\d{15,25}$/),
});

export type AnnounceTone = (typeof TONES)[number];
export const ANNOUNCE_TONES: readonly AnnounceTone[] = TONES;

export interface GenerateAnnouncementResult {
  draft: string;
  model: string;
}

export const generateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => generateSchema.parse(input))
  .handler(async ({ data }): Promise<GenerateAnnouncementResult> => {
    await requirePermission("config.manage");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `Tu es l'historien officiel de la faction Minecraft "PunkAstik" sur le serveur Paladium. Tu rédiges une ANNONCE COURTE à destination des membres, en français, ton ${data.tone} mais factuel, sans emojis excessifs (2 max sur tout le message).

Contraintes :
- Markdown léger compatible Discord (gras **…**, listes "- …", titres ## maxi).
- Maximum 180 mots.
- Commence directement par le contenu (pas de "voici l'annonce…").
- Ne fabrique aucun chiffre, nom, date ou événement absent du sujet fourni.
- Ne mentionne JAMAIS un membre par son discord_id brut ; utilise son ig_name si fourni.
- Termine par 1 ligne d'appel à l'action concrète si pertinent.`;

    const userPrompt = `Sujet de l'annonce :\n\n${data.topic}\n\nRédige le brouillon markdown.`;

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
      console.error("announce: gateway fetch failed", err);
      throw new Error("AI gateway unreachable");
    }

    if (res.status === 429) throw new Error("AI gateway rate-limited, réessaie dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Recharge ton workspace Lovable.");
    if (!res.ok) {
      const body = await res.text();
      console.error("announce: gateway error", res.status, body);
      throw new Error(`AI gateway error ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const draft = json.choices?.[0]?.message?.content?.trim();
    if (!draft) throw new Error("Réponse IA vide");

    return { draft, model: DEFAULT_MODEL };
  });

export interface PublishAnnouncementResult {
  ok: true;
  channel: string;
}

export const publishAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => publishSchema.parse(input))
  .handler(async ({ data }): Promise<PublishAnnouncementResult> => {
    const user = await requirePermission("config.manage");

    if (!process.env.DISCORD_BOT_TOKEN) {
      throw new Error("DISCORD_BOT_TOKEN manquant côté serveur");
    }

    // Discord plafonne à 2000 caractères par message ; on tronque proprement.
    const content = data.text.length > 1990 ? data.text.slice(0, 1989) + "…" : data.text;

    await postToChannel(data.channel, { content });

    await logAction("announcement.publish", user.discordId, {
      channel: data.channel,
      length: content.length,
    });

    return { ok: true, channel: data.channel };
  });
