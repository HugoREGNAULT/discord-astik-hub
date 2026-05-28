import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/lib/auth/require.server";
import { listAllGuildMembers, type DiscordGuildMember } from "@/lib/discord/api.server";
import { GUILDS, EFFECTIF_GRADES } from "@/lib/discord/constants";
import { db } from "@/lib/db.server";

interface EffectifGroup {
  label: string;
  members: { discord_id: string; name: string; avatarUrl: string | null }[];
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

  const seen = new Set<string>();
  const groups: EffectifGroup[] = gradeRoleIds.map((g) => {
    const list: EffectifGroup["members"] = [];
    for (const m of members) {
      const uid = m.user?.id;
      if (!uid || seen.has(uid)) continue;
      if (g.roleIds.some((rid) => m.roles.includes(rid))) {
        seen.add(uid);
        list.push({
          discord_id: uid,
          name: m.nick || m.user?.global_name || m.user?.username || uid,
          avatarUrl: m.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${m.user.avatar}.png`
            : null,
        });
      }
    }
    return { label: g.label, members: list };
  });

  const total = seen.size;
  return { groups, total };
});
