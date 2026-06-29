import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { listAllGuildMembers } from "@/lib/discord/api.server";
import { GUILDS, ROLES } from "@/lib/discord/constants";

export const syncMembersFromDiscord = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requirePermission("admin.access");

  // 1. Récupère tous les membres Discord de la guild faction
  const allGuildMembers = await listAllGuildMembers(GUILDS.FACTION);
  const factionMembers = allGuildMembers.filter((m) => m.roles.includes(ROLES.MEMBER_FACTION));
  const factionMap = new Map(factionMembers.filter((m) => m.user?.id).map((m) => [m.user!.id, m]));

  // 2. Lit tous les membres de la DB (actifs et archivés)
  const { data: dbMembers, error: dbErr } = await db
    .from("members")
    .select("discord_id, status, archived_at");
  if (dbErr) throw new Error(dbErr.message);

  const dbMap = new Map((dbMembers ?? []).map((m) => [m.discord_id, m]));

  let added = 0;
  let updated = 0;
  let reactivated = 0;
  let archived = 0;

  // 3. Traite les membres Discord ayant le rôle
  for (const [discordId, gm] of factionMap) {
    const avatarUrl = gm.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${gm.user.avatar}.webp`
      : null;
    const dbRow = dbMap.get(discordId);

    if (!dbRow) {
      // Nouveau membre : INSERT
      await db.from("members").insert({
        discord_id: discordId,
        discord_username: gm.user?.username ?? null,
        roles: gm.roles,
        avatar_url: avatarUrl,
        status: "active",
      });
      added++;
    } else if (dbRow.status === "former") {
      // Réactivation
      await db
        .from("members")
        .update({
          status: "active",
          archived_at: null,
          discord_username: gm.user?.username ?? null,
          roles: gm.roles,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", discordId);
      reactivated++;
    } else {
      // Mise à jour infos Discord
      await db
        .from("members")
        .update({
          discord_username: gm.user?.username ?? null,
          roles: gm.roles,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", discordId);
      updated++;
    }
  }

  // 4. Archive les membres actifs qui n'ont plus le rôle
  for (const dbRow of dbMembers ?? []) {
    if (dbRow.status !== "active") continue;
    if (!factionMap.has(dbRow.discord_id)) {
      await db
        .from("members")
        .update({
          status: "former",
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", dbRow.discord_id);
      archived++;
    }
  }

  await logAction("members_sync_discord", user.discordId, {
    added,
    archived,
    updated,
    reactivated,
  });

  return { added, archived, updated, reactivated };
});
