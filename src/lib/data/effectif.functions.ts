import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/lib/auth/require.server";
import { listAllGuildMembers, type DiscordGuildMember } from "@/lib/discord/api.server";
import { GUILDS, EFFECTIF_GRADES, ROLES } from "@/lib/discord/constants";
import { db } from "@/lib/db.server";

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

  // Liste les membres du guild faction + du guild public (pour les recruteurs)
  let members: DiscordGuildMember[] = [];
  let publicMembers: DiscordGuildMember[] = [];
  try {
    [members, publicMembers] = await Promise.all([
      listAllGuildMembers(GUILDS.FACTION),
      listAllGuildMembers(GUILDS.PUBLIC).catch(() => [] as DiscordGuildMember[]),
    ]);
  } catch (e) {
    await db.from("logs").insert({
      level: "error",
      action: "effectif_fetch_failed",
      payload: { error: (e as Error).message } as never,
    });
    throw e;
  }

  // Recruteurs = porteurs du rôle RECRUITER_PUBLIC sur le guild public.
  const publicById = new Map<string, DiscordGuildMember>();
  for (const m of publicMembers) if (m.user?.id) publicById.set(m.user.id, m);
  const recruiterIds = new Set<string>(
    publicMembers
      .filter((m) => m.roles?.includes(ROLES.RECRUITER_PUBLIC))
      .map((m) => m.user?.id)
      .filter(Boolean) as string[],
  );

  // Récupère les IG names et la blacklist en une fois (faction + recruteurs publics)
  const allDiscordIds = Array.from(
    new Set([...(members.map((m) => m.user?.id).filter(Boolean) as string[]), ...recruiterIds]),
  );
  const [{ data: dbMembers }, { data: blacklistRows }] = await Promise.all([
    db
      .from("members")
      .select("discord_id, ig_name, current_grade, arrival_date, mc_uuid")
      .in("discord_id", allDiscordIds),
    db.from("blacklist").select("discord_id").not("discord_id", "is", null),
  ]);
  const igByDiscord = new Map<string, string | null>(
    (dbMembers ?? []).map((m) => [m.discord_id, m.ig_name ?? null]),
  );
  const blacklisted = new Set<string>(
    (blacklistRows ?? []).flatMap((b) => (b.discord_id ? [b.discord_id] : [])),
  );

  const factionById = new Map<string, DiscordGuildMember>();
  for (const m of members) if (m.user?.id) factionById.set(m.user.id, m);

  const buildMember = (uid: string, src: DiscordGuildMember): EffectifMember => {
    const igName = igByDiscord.get(uid) ?? null;
    // Priorité : IG name (DB) → nick Discord → global_name → username
    const displayName = igName || src.nick || src.user?.global_name || src.user?.username || uid;
    return {
      discord_id: uid,
      name: displayName,
      ig_name: igName,
      avatarUrl: src.user?.avatar
        ? `https://cdn.discordapp.com/avatars/${uid}/${src.user.avatar}.png`
        : null,
      blacklisted: blacklisted.has(uid),
    };
  };

  const seen = new Set<string>();
  const groups: EffectifGroup[] = gradeRoleIds.map((g) => {
    const list: EffectifMember[] = [];
    if (g.label === "Recruteur") {
      // Recruteur = rôle RECRUITER_PUBLIC sur le serveur public.
      // Source d'affichage : profil faction si existant, sinon profil public.
      for (const uid of recruiterIds) {
        if (seen.has(uid)) continue;
        const src = factionById.get(uid) ?? publicById.get(uid);
        if (!src) continue;
        seen.add(uid);
        list.push(buildMember(uid, src));
      }
    } else {
      for (const m of members) {
        const uid = m.user?.id;
        if (!uid || seen.has(uid)) continue;
        if (g.roleIds.some((rid) => m.roles.includes(rid))) {
          seen.add(uid);
          list.push(buildMember(uid, m));
        }
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    return { label: g.label, members: list };
  });

  // Total = uniquement les membres classés dans un grade (pas de "Sans grade").
  const total = groups.reduce((s, g) => s + g.members.length, 0);
  return { groups, total };
});
