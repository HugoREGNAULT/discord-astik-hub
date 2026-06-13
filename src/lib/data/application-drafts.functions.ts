/**
 * Brouillons de candidature côté serveur.
 * - saveDraft        : le candidat (connecté) sauvegarde sa progression + des
 *                      signaux d'authenticité (collages, dynamique de frappe).
 *                      Appelée en debounce par le formulaire.
 * - listActiveDrafts : les recruteurs voient les candidatures EN COURS (non
 *                      soumises) avec leurs signaux anti copier-coller / IA.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission } from "@/lib/auth/require.server";

const pasteEventSchema = z.object({
  len: z.number().int().nonnegative().max(100000),
  t: z.number().int().nonnegative(),
});

const draftSchema = z.object({
  heardFrom: z.string().max(3000).optional().default(""),
  mcName: z.string().max(40).optional().default(""),
  presentationIrl: z.string().max(6000).optional().default(""),
  age: z.string().max(10).optional().default(""),
  country: z.string().max(60).optional().default(""),
  presentationGaming: z.string().max(6000).optional().default(""),
  schedule: z.string().max(3000).optional().default(""),
  objectives: z.string().max(4000).optional().default(""),
  pvpLevel: z.number().int().min(1).max(10).optional(),
  motivation: z.string().max(4000).optional().default(""),
  additionalInfo: z.string().max(4000).optional().default(""),
  formRating: z.number().min(0).max(5).optional(),
  // Signaux d'authenticité (cumuls calculés côté client)
  pasteCount: z.number().int().nonnegative().max(1_000_000).optional().default(0),
  pasteTotalChars: z.number().int().nonnegative().max(50_000_000).optional().default(0),
  pasteEvents: z.array(pasteEventSchema).max(300).optional().default([]),
  keystrokeCount: z.number().int().nonnegative().max(50_000_000).optional().default(0),
  charCount: z.number().int().nonnegative().max(50_000_000).optional().default(0),
  typingMs: z.number().int().nonnegative().max(86_400_000).optional().default(0),
});

export const saveDraft = createServerFn({ method: "POST" })
  .inputValidator((input) => draftSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const ageNum = /^\d+$/.test(data.age) ? Number(data.age) : null;
    const { error } = await db.from("application_drafts").upsert(
      {
        discord_id: user.discordId,
        discord_username: user.username,
        mc_name: data.mcName || null,
        heard_from: data.heardFrom || null,
        presentation: data.presentationIrl || null,
        presentation_gaming: data.presentationGaming || null,
        age: ageNum,
        country: data.country || null,
        schedule: data.schedule || null,
        objectives: data.objectives || null,
        pvp_level: data.pvpLevel ?? null,
        motivation: data.motivation || null,
        additional_info: data.additionalInfo || null,
        form_rating: data.formRating ?? null,
        paste_count: data.pasteCount,
        paste_total_chars: data.pasteTotalChars,
        paste_events: data.pasteEvents.slice(-200),
        keystroke_count: data.keystrokeCount,
        char_count: data.charCount,
        typing_ms: data.typingMs,
        submitted: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "discord_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ApplicationDraft = {
  discord_id: string;
  discord_username: string | null;
  mc_name: string | null;
  heard_from: string | null;
  presentation: string | null;
  presentation_gaming: string | null;
  age: number | null;
  country: string | null;
  schedule: string | null;
  objectives: string | null;
  pvp_level: number | null;
  motivation: string | null;
  additional_info: string | null;
  form_rating: number | null;
  paste_count: number;
  paste_total_chars: number;
  paste_events: { len: number; t: number }[];
  keystroke_count: number;
  char_count: number;
  typing_ms: number;
  started_at: string;
  updated_at: string;
};

export const listActiveDrafts = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("recruit.access");
  const res = await db
    .from("application_drafts")
    .select("*")
    .eq("submitted", false)
    .gt("char_count", 0)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((d) => ({
    ...d,
    paste_events: Array.isArray(d.paste_events)
      ? (d.paste_events as { len: number; t: number }[])
      : [],
  })) as ApplicationDraft[];
});
