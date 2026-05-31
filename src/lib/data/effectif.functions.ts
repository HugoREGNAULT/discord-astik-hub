import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/lib/auth/require.server";
import { listAllGuildMembers, type DiscordGuildMember } from "@/lib/discord/api.server";
import { GUILDS, EFFECTIF_GRADES } from "@/lib/discord/constants";
import { db } from "@/lib/db.server";
import { filterFactionMembers } from "@/lib/data/faction-members";

interface EffectifMember {
  discord_id: string;
  name: string;
  ig_name: string | null;
  avatarUrl: string | null;
  blacklisted: boolean;
}

interface EffectifGroup {
  label: string;
  members: EffectifMember[];
}

export const getEffectif = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();

  // On a besoin des rôles par nom — on liste les rôles du guild
  const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${GUILDS.FACTION}/roles`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!}` },
  });
  if (!rolesRes.ok) throw new Error(`Discord roles failed: ${rolesRes.status}`);
  const guildRoles: { id: string; name: string }[] = await rolesRes.json();

  // Map grade label -> role ids
  const gradeRoleIds = EFFECTIF_GRADES.map((g) => {
    const ids = guildRoles
      .filter((r) => g.matchNames.some((n) => r.name.toLowerCase() === n.toLowerCase()))
      .map((r) => r.id);
    return { label: g.label, roleIds: ids };
  });

  // Liste les membres du guild
  let members: DiscordGuildMember[] = [];
  try {
    members = await listAllGuildMembers(GUILDS.FACTION);
  } catch (e) {
    await db.from("logs").insert({
      level: "error",
      action: "effectif_fetch_failed",
      payload: { error: (e as Error).message } as never,
    });
    throw e;
  }

  // Récupère les IG names et la blacklist en une fois
  const allDiscordIds = members.map((m) => m.user?.id).filter(Boolean) as string[];
  const [{ data: dbMembers }, { data: blacklistRows }] = await Promise.all([
    db
      .from("members")
      .select("discord_id, ig_name, current_grade, arrival_date, mc_uuid")
      .in("discord_id", allDiscordIds),
    db.from("blacklist").select("discord_id").not("discord_id", "is", null),
  ]);
  const factionDbMembers = filterFactionMembers(dbMembers ?? []);
  const factionIds = new Set(factionDbMembers.map((m) => m.discord_id));
  const igByDiscord = new Map<string, string | null>(
    factionDbMembers.map((m) => [m.discord_id, m.ig_name ?? null]),
  );
  const blacklisted = new Set<string>(
    (blacklistRows ?? []).flatMap((b) => (b.discord_id ? [b.discord_id] : [])),
  );

  const seen = new Set<string>();
  const groups: EffectifGroup[] = gradeRoleIds.map((g) => {
    const list: EffectifMember[] = [];
    for (const m of members) {
      const uid = m.user?.id;
      if (!uid || seen.has(uid)) continue;
      if (g.roleIds.some((rid) => m.roles.includes(rid)) && factionIds.has(uid)) {
        seen.add(uid);
        const igName = igByDiscord.get(uid) ?? null;
        // Priorité : IG name (DB) → nick Discord → global_name → username
        const displayName = igName || m.nick || m.user?.global_name || m.user?.username || uid;
        list.push({
          discord_id: uid,
          name: displayName,
          ig_name: igName,
          avatarUrl: m.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${m.user.avatar}.png`
            : null,
          blacklisted: blacklisted.has(uid),
        });
      }
    }
    // tri alphabétique pour stabilité
    list.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    return { label: g.label, members: list };
  });

  const total = seen.size;
  return { groups, total };
});
