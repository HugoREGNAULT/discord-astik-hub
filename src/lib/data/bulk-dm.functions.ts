/**
 * Outils de DM massif Discord pour le staff.
 *
 * Permet de cibler des audiences (jamais connectés au dashboard, sondage non
 * voté, inactifs 7j, tous actifs) et d'envoyer un DM Discord à tout le monde
 * avec un throttle pour respecter le rate limit du bot.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

type MemberRow = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  current_grade: string | null;
};

const SELECT = "discord_id, discord_username, ig_name, avatar_url, current_grade";

async function listActiveMembers(): Promise<MemberRow[]> {
  const { data, error } = await db.from("members").select(SELECT).eq("status", "active");
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}

const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_active") }),
  z.object({ kind: z.literal("inactive_7d") }),
  z.object({ kind: z.literal("never_logged_in") }),
  z.object({ kind: z.literal("poll_not_voted"), pollId: z.string().uuid() }),
]);

export type DmAudience = z.infer<typeof audienceSchema>;

async function resolveTargets(audience: DmAudience): Promise<MemberRow[]> {
  const members = await listActiveMembers();
  if (audience.kind === "all_active") return members;

  if (audience.kind === "inactive_7d") {
    const { data } = await db
      .from("members")
      .select(SELECT)
      .eq("status", "active")
      .eq("messages_7d", 0)
      .eq("voice_7d_seconds", 0);
    return (data ?? []) as MemberRow[];
  }

  if (audience.kind === "never_logged_in") {
    const { data: logs } = await db
      .from("logs")
      .select("actor_discord_id")
      .eq("action", "login")
      .not("actor_discord_id", "is", null);
    const seen = new Set((logs ?? []).map((l) => l.actor_discord_id as string));
    return members.filter((m) => !seen.has(m.discord_id));
  }

  // poll_not_voted
  const { data: votes } = await db
    .from("poll_votes")
    .select("voter_discord_id")
    .eq("poll_id", audience.pollId);
  const voted = new Set((votes ?? []).map((v) => v.voter_discord_id as string));
  return members.filter((m) => !voted.has(m.discord_id));
}

/** Récupère les sondages ouverts (pour cibler "n'ont pas voté"). */
export const listOpenPollsForDm = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.edit");
  const { data, error } = await db
    .from("polls")
    .select("id, title, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return { polls: data ?? [] };
});

/** Prévisualisation de l'audience (sans envoyer). */
export const previewDmAudience = createServerFn({ method: "POST" })
  .inputValidator((input: { audience: DmAudience }) =>
    z.object({ audience: audienceSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("members.edit");
    const targets = await resolveTargets(data.audience);
    return {
      count: targets.length,
      sample: targets.slice(0, 20).map((t) => ({
        discord_id: t.discord_id,
        ig_name: t.ig_name,
        discord_username: t.discord_username,
        avatar_url: t.avatar_url,
        current_grade: t.current_grade,
      })),
    };
  });

/** Remplace {ig_name} / {discord_username} / {grade} dans le contenu. */
function personalize(template: string, m: MemberRow): string {
  return template
    .replaceAll("{ig_name}", m.ig_name ?? m.discord_username ?? "")
    .replaceAll("{discord_username}", m.discord_username ?? "")
    .replaceAll("{grade}", m.current_grade ?? "");
}

/**
 * Envoi en masse. Throttle ~4 DM/s pour respecter Discord (5/s par bot).
 * Limite dure 500 destinataires/appel pour éviter les abus.
 */
export const sendBulkDm = createServerFn({ method: "POST" })
  .inputValidator((input: { audience: DmAudience; content: string }) =>
    z
      .object({
        audience: audienceSchema,
        content: z.string().trim().min(1).max(1800),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const targets = await resolveTargets(data.audience);
    if (targets.length === 0) return { ok: true, sent: 0, failed: 0, total: 0 };
    if (targets.length > 500) throw new Error("Audience trop large (>500). Filtre davantage.");

    const { sendDiscordDM } = await import("@/lib/discord/dm.server");

    let sent = 0;
    let failed = 0;
    const errors: { discord_id: string; error: string }[] = [];

    for (const m of targets) {
      const content = personalize(data.content, m);
      const res = await sendDiscordDM(m.discord_id, content);
      if (res.ok) sent++;
      else {
        failed++;
        if (errors.length < 20) errors.push({ discord_id: m.discord_id, error: res.error ?? "?" });
      }
      // ~4/s
      await new Promise((r) => setTimeout(r, 250));
    }

    await logAction("bulk_dm", user.discordId, {
      audience: data.audience,
      total: targets.length,
      sent,
      failed,
      length: data.content.length,
      errors,
    });

    return { ok: true, sent, failed, total: targets.length, errors };
  });
