/**
 * Outils de DM massif Discord pour le staff.
 *
 * Audiences supportées :
 *  - all_active        : membres actifs (table members)
 *  - inactive_7d       : 0 message & 0 vocal sur 7j
 *  - never_logged_in   : aucun "login" dans les logs
 *  - poll_not_voted    : n'ont pas voté à un sondage donné
 *  - role_all          : tous les membres du serveur faction ayant un rôle Discord donné
 *  - role_never_logged_in : ceux qui ont le rôle ET ne se sont jamais connectés au dashboard
 *
 * Throttle : ~4 DM/s. Cap dur : 500 destinataires par appel.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { listAllGuildMembers } from "@/lib/discord/api.server";
import { GUILDS } from "@/lib/discord/constants";

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
  z.object({ kind: z.literal("role_all"), roleId: z.string().regex(/^\d{5,32}$/) }),
  z.object({
    kind: z.literal("role_never_logged_in"),
    roleId: z.string().regex(/^\d{5,32}$/),
  }),
]);

export type DmAudience = z.infer<typeof audienceSchema>;

/** Récupère les discord_id ayant un "login" dans les logs. */
async function loggedInIds(): Promise<Set<string>> {
  const { data } = await db
    .from("logs")
    .select("actor_discord_id")
    .eq("action", "login")
    .not("actor_discord_id", "is", null);
  return new Set((data ?? []).map((l) => l.actor_discord_id as string));
}

/** Construit une MemberRow depuis l'API Discord + complète via DB si dispo. */
async function buildRowsForDiscordIds(discordIds: string[]): Promise<MemberRow[]> {
  if (discordIds.length === 0) return [];
  // Map enrichissement via DB (par chunks pour éviter URL trop longues)
  const dbMap = new Map<string, Partial<MemberRow>>();
  const chunkSize = 200;
  for (let i = 0; i < discordIds.length; i += chunkSize) {
    const chunk = discordIds.slice(i, i + chunkSize);
    const { data } = await db.from("members").select(SELECT).in("discord_id", chunk);
    for (const m of (data ?? []) as MemberRow[]) dbMap.set(m.discord_id, m);
  }
  return discordIds.map((id) => {
    const row = dbMap.get(id);
    return {
      discord_id: id,
      discord_username: row?.discord_username ?? null,
      ig_name: row?.ig_name ?? null,
      avatar_url: row?.avatar_url ?? null,
      current_grade: row?.current_grade ?? null,
    };
  });
}

/** Renvoie l'ensemble des discord_id (humains, non bots) actuellement sur la guild faction. */
async function factionGuildMemberIds(): Promise<Set<string>> {
  const gm = await listAllGuildMembers(GUILDS.FACTION);
  const ids = new Set<string>();
  for (const m of gm) {
    const uid = m.user?.id;
    if (!uid) continue;
    if ((m.user as { bot?: boolean } | undefined)?.bot) continue;
    ids.add(uid);
  }
  return ids;
}

async function resolveTargets(audience: DmAudience): Promise<MemberRow[]> {
  // Filet de sécurité : pour toute audience basée sur la DB, on intersecte avec
  // la liste réelle des membres présents sur le serveur FACTION (privé).
  // Empêche d'envoyer un DM à un membre du serveur public encore présent en DB.
  const dbBased =
    audience.kind === "all_active" ||
    audience.kind === "inactive_7d" ||
    audience.kind === "never_logged_in" ||
    audience.kind === "poll_not_voted";

  const rows = await resolveTargetsRaw(audience);
  if (!dbBased) return rows;
  const factionIds = await factionGuildMemberIds();
  return rows.filter((r) => factionIds.has(r.discord_id));
}

async function resolveTargetsRaw(audience: DmAudience): Promise<MemberRow[]> {
  if (audience.kind === "all_active") return listActiveMembers();

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
    const members = await listActiveMembers();
    const seen = await loggedInIds();
    return members.filter((m) => !seen.has(m.discord_id));
  }

  if (audience.kind === "poll_not_voted") {
    const members = await listActiveMembers();
    const { data: votes } = await db
      .from("poll_votes")
      .select("voter_discord_id")
      .eq("poll_id", audience.pollId);
    const voted = new Set((votes ?? []).map((v) => v.voter_discord_id as string));
    return members.filter((m) => !voted.has(m.discord_id));
  }

  // role_all / role_never_logged_in : on s'appuie sur la liste Discord du serveur faction
  const guildMembers = await listAllGuildMembers(GUILDS.FACTION);
  const targetIds: string[] = [];
  for (const gm of guildMembers) {
    const uid = gm.user?.id;
    if (!uid) continue;
    if ((gm.user as { bot?: boolean } | undefined)?.bot) continue;
    if (gm.roles.includes(audience.roleId)) targetIds.push(uid);
  }
  let rows = await buildRowsForDiscordIds(targetIds);
  // Compléter le username Discord depuis la guild si manquant (utiles aux gens
  // pas encore dans `members`).
  const nameByDiscord = new Map<string, string>();
  for (const gm of guildMembers) {
    const uid = gm.user?.id;
    if (!uid) continue;
    nameByDiscord.set(uid, gm.nick || gm.user?.global_name || gm.user?.username || uid);
  }
  rows = rows.map((r) => ({
    ...r,
    discord_username: r.discord_username ?? nameByDiscord.get(r.discord_id) ?? null,
  }));
  if (audience.kind === "role_never_logged_in") {
    const seen = await loggedInIds();
    rows = rows.filter((r) => !seen.has(r.discord_id));
  }
  return rows;
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

/** Liste les rôles du serveur faction (pour cibler par rôle). */
export const listFactionRoles = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.edit");
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILDS.FACTION}/roles`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!}` },
  });
  if (!res.ok) throw new Error(`Discord roles failed: ${res.status}`);
  const roles: { id: string; name: string; position: number; managed?: boolean }[] =
    await res.json();
  const filtered = roles
    .filter((r) => !r.managed && r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));
  return { roles: filtered };
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

/** Export complet de l'audience pour CSV (jusqu'à 500 lignes). */
export const exportDmAudience = createServerFn({ method: "POST" })
  .inputValidator((input: { audience: DmAudience }) =>
    z.object({ audience: audienceSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("members.edit");
    const targets = await resolveTargets(data.audience);
    return {
      rows: targets.slice(0, 500).map((t) => ({
        discord_id: t.discord_id,
        ig_name: t.ig_name,
        discord_username: t.discord_username,
        current_grade: t.current_grade,
      })),
      total: targets.length,
    };
  });

/** Historique des campagnes de DM massif (lecture depuis `logs`). */
export const listBulkDmHistory = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.edit");
  const { data, error } = await db
    .from("logs")
    .select("id, created_at, actor_discord_id, payload")
    .eq("action", "bulk_dm")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
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
