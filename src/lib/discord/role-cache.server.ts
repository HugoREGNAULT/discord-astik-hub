/**
 * Cache PARTAGÉ (table discord_role_cache) des rôles agrégés par membre.
 * - Lecture : si on a les deux guilds (PUBLIC + FACTION) en cache et que la
 *   ligne la plus ancienne date de < 5 min, on renvoie l'union dédupliquée
 *   sans appeler Discord.
 * - Miss / stale : on rafraîchit via le bot (catch -> null par guild) puis
 *   upsert sur (discord_id, guild_id). Échec Discord = fallback sur les
 *   role_ids en cache s'ils existent, sinon [].
 */
import { db } from "@/lib/db.server";
import { GUILDS } from "./constants";
import { getGuildMember } from "./api.server";

const TTL_MS = 5 * 60 * 1000;
const ALL_GUILDS: string[] = [GUILDS.PUBLIC, GUILDS.FACTION];

type CacheRow = {
  guild_id: string;
  role_ids: string[] | null;
  nickname: string | null;
  refreshed_at: string;
};

function unionRoles(rows: Pick<CacheRow, "role_ids">[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    for (const id of r.role_ids ?? []) set.add(id);
  }
  return [...set];
}

export async function getAggregatedRolesCached(discordId: string): Promise<string[]> {
  const { data: rows } = await db
    .from("discord_role_cache")
    .select("guild_id, role_ids, nickname, refreshed_at")
    .eq("discord_id", discordId);

  const cached = (rows ?? []) as CacheRow[];
  const byGuild = new Map(cached.map((r) => [r.guild_id, r]));

  const haveAll = ALL_GUILDS.every((g) => byGuild.has(g));
  if (haveAll) {
    const oldest = Math.min(
      ...ALL_GUILDS.map((g) => new Date(byGuild.get(g)!.refreshed_at).getTime()),
    );
    if (Date.now() - oldest < TTL_MS) {
      return unionRoles(cached);
    }
  }

  // Refresh : fetch + upsert par guild, sans throw.
  const fresh: CacheRow[] = [];
  for (const guildId of ALL_GUILDS) {
    let member: Awaited<ReturnType<typeof getGuildMember>> = null;
    try {
      member = await getGuildMember(guildId, discordId);
    } catch {
      member = null;
    }

    if (member) {
      const row = {
        discord_id: discordId,
        guild_id: guildId,
        role_ids: member.roles ?? [],
        nickname: member.nick ?? null,
        refreshed_at: new Date().toISOString(),
      };
      try {
        await db
          .from("discord_role_cache")
          .upsert(row, { onConflict: "discord_id,guild_id" });
      } catch {
        // upsert failure : on garde quand même la valeur fraîche en mémoire
      }
      fresh.push({
        guild_id: guildId,
        role_ids: row.role_ids,
        nickname: row.nickname,
        refreshed_at: row.refreshed_at,
      });
    } else {
      // Fallback sur la ligne en cache si on a déjà quelque chose.
      const prev = byGuild.get(guildId);
      if (prev) fresh.push(prev);
    }
  }

  return unionRoles(fresh);
}
