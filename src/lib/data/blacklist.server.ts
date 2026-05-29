/**
 * Helpers serveur pour la blacklist (réutilisés depuis applications.functions).
 * Recherche les correspondances entre des identifiants candidat et la table blacklist.
 */
import { db } from "@/lib/db.server";

export type BlacklistMatch = {
  id: string;
  matched_on: ("discord_id" | "mc_name" | "mc_uuid")[];
  discord_id: string | null;
  mc_name: string | null;
  mc_uuid: string | null;
  reason: string;
  added_by_username: string | null;
  created_at: string;
};

/**
 * Trouve les entrées blacklist matchant l'un des identifiants fournis.
 * Match insensible à la casse pour mc_name.
 */
export async function findBlacklistMatches(input: {
  discordId?: string | null;
  mcName?: string | null;
  mcUuid?: string | null;
}): Promise<BlacklistMatch[]> {
  const filters: string[] = [];
  if (input.discordId) filters.push(`discord_id.eq.${input.discordId}`);
  if (input.mcName) filters.push(`mc_name.ilike.${input.mcName}`);
  if (input.mcUuid) filters.push(`mc_uuid.eq.${input.mcUuid}`);
  if (filters.length === 0) return [];

  const { data, error } = await db
    .from("blacklist")
    .select("id, discord_id, mc_name, mc_uuid, reason, added_by_username, created_at")
    .or(filters.join(","));
  if (error || !data) return [];

  return data.map((row) => {
    const matched_on: BlacklistMatch["matched_on"] = [];
    if (input.discordId && row.discord_id === input.discordId) matched_on.push("discord_id");
    if (input.mcName && row.mc_name && row.mc_name.toLowerCase() === input.mcName.toLowerCase())
      matched_on.push("mc_name");
    if (input.mcUuid && row.mc_uuid === input.mcUuid) matched_on.push("mc_uuid");
    return { ...row, matched_on };
  });
}
