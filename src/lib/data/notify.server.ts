/**
 * notify() — helper central pour créer une notification persistée en DB
 * et éventuellement envoyer un DM Discord si l'utilisateur l'a activé
 * pour ce `kind` dans notification_prefs.
 *
 * Échec silencieux : ne fait jamais throw — une notif ratée ne doit pas
 * casser l'action métier qui l'a déclenchée.
 */
import { z } from "zod";
import { db } from "@/lib/db.server";
import { sendDiscordDM } from "@/lib/discord/dm.server";

const inputSchema = z.object({
  recipientDiscordId: z.string().min(1).max(64),
  kind: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).optional(),
  href: z.string().max(500).optional(),
});

export type NotifyInput = z.infer<typeof inputSchema>;

export async function notify(input: NotifyInput): Promise<{ ok: boolean }> {
  let parsed: NotifyInput;
  try {
    parsed = inputSchema.parse(input);
  } catch (err) {
    console.error("notify: invalid input", err);
    return { ok: false };
  }

  try {
    const { error } = await db.from("notifications").insert({
      recipient_discord_id: parsed.recipientDiscordId,
      kind: parsed.kind,
      title: parsed.title,
      detail: parsed.detail ?? null,
      href: parsed.href ?? null,
    });
    if (error) {
      console.error("notify: insert failed", error.message);
      return { ok: false };
    }
  } catch (err) {
    console.error("notify: db failure", err);
    return { ok: false };
  }

  // Préférence DM Discord ?
  try {
    const { data: pref } = await db
      .from("notification_prefs")
      .select("discord_dm")
      .eq("discord_id", parsed.recipientDiscordId)
      .eq("kind", parsed.kind)
      .maybeSingle();
    if (pref?.discord_dm) {
      const body = parsed.detail
        ? `**${parsed.title}**\n${parsed.detail}`
        : `**${parsed.title}**`;
      void sendDiscordDM(parsed.recipientDiscordId, body);
    }
  } catch (err) {
    // silencieux
    console.warn("notify: DM pref lookup failed", err);
  }

  return { ok: true };
}
