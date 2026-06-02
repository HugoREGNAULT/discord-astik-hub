import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { filterFactionMembers, isFactionMember } from "@/lib/data/faction-members";

/**
 * Tableau de bord staff : KPIs et activité récente, accessible à tout
 * staff faction / staff points (perm members.view).
 */
export const getStaffDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [
    pendingApps,
    activeDonations,
    activeMembers,
    formerMembers,
    inactiveMembers,
    recentWarnings,
    recentApps,
    recentDonations,
    topPoints7d,
    staffActivity,
    appsTimeline,
    appsTotals,
  ] = await Promise.all([
    db.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),

    db.from("donations").select("id", { count: "exact", head: true }).eq("status", "active"),
    db
      .from("members")
      .select("discord_id, ig_name, current_grade, arrival_date, mc_uuid")
      .eq("status", "active"),
    db
      .from("members")
      .select("discord_id, ig_name, current_grade, arrival_date, mc_uuid")
      .eq("status", "former"),
    db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid, messages_7d, voice_7d_seconds",
      )
      .eq("status", "active")
      .eq("messages_7d", 0)
      .eq("voice_7d_seconds", 0)
      .order("ig_name", { ascending: true, nullsFirst: false })
      .limit(50),
    db
      .from("warnings")
      .select("id, member_discord_id, body, staff_username, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("applications")
      .select("id, discord_username, mc_name, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("donations")
      .select("id, member_discord_id, staff_username, total_final, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    db.from("points_ledger").select("member_discord_id, amount").gte("created_at", since7d),
    db
      .from("logs")
      .select("id, action, actor_discord_id, level, payload, created_at")
      .not("actor_discord_id", "is", null)
      .neq("action", "permission_denied")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(15),
    db
      .from("applications")
      .select("created_at, status, decided_at")
      .gte("created_at", since90d)
      .order("created_at", { ascending: true }),
    db.from("applications").select("status"),
  ]);

  // Aggregate top contributors over last 7 days
  const sums = new Map<string, number>();
  for (const row of topPoints7d.data ?? []) {
    const id = row.member_discord_id;
    const amt = row.amount;
    sums.set(id, (sums.get(id) ?? 0) + amt);
  }
  const topIds = Array.from(sums.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let topContributors: Array<{
    discord_id: string;
    ig_name: string | null;
    discord_username: string | null;
    avatar_url: string | null;
    points: number;
  }> = [];
  if (topIds.length > 0) {
    const { data: members } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, avatar_url, current_grade, arrival_date, mc_uuid")
      .in(
        "discord_id",
        topIds.map(([id]) => id),
      );
    const byId = new Map(
      (members ?? [])
        .filter((member) => isFactionMember(member))
        .map((member) => [member.discord_id, member] as const),
    );
    topContributors = topIds
      .filter(([id]) => byId.has(id))
      .map(([id, points]) => {
        const m = byId.get(id);
        return {
          discord_id: id,
          ig_name: m?.ig_name ?? null,
          discord_username: m?.discord_username ?? null,
          avatar_url: m?.avatar_url ?? null,
          points,
        };
      });
  }

  // Applications timeline: daily counts over the last 90 days
  const timelineMap = new Map<string, { created: number; accepted: number; rejected: number }>();
  // seed all days so the chart has a continuous x-axis
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    timelineMap.set(key, { created: 0, accepted: 0, rejected: 0 });
  }
  for (const row of appsTimeline.data ?? []) {
    const r = row as { created_at: string; status: string; decided_at: string | null };
    const cKey = r.created_at.slice(0, 10);
    const cBucket = timelineMap.get(cKey);
    if (cBucket) cBucket.created += 1;
    if (r.decided_at && (r.status === "accepted" || r.status === "rejected")) {
      const dKey = r.decided_at.slice(0, 10);
      const dBucket = timelineMap.get(dKey);
      if (dBucket) {
        if (r.status === "accepted") dBucket.accepted += 1;
        else dBucket.rejected += 1;
      }
    }
  }
  const applicationsTimeline = Array.from(timelineMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  // Applications totals (all-time)
  let totalApps = 0,
    totalAccepted = 0,
    totalRejected = 0;
  for (const row of appsTotals.data ?? []) {
    totalApps += 1;
    const s = (row as { status: string }).status;
    if (s === "accepted") totalAccepted += 1;
    else if (s === "rejected") totalRejected += 1;
  }
  const acceptanceRate =
    totalAccepted + totalRejected > 0
      ? Math.round((totalAccepted / (totalAccepted + totalRejected)) * 100)
      : 0;

  const activeFactionMembers = filterFactionMembers(activeMembers.data ?? []);
  const formerFactionMembers = filterFactionMembers(formerMembers.data ?? []);
  const inactiveFactionMembers = filterFactionMembers(inactiveMembers.data ?? []);

  return {
    kpis: {
      activeMembers: activeFactionMembers.length,
      formerMembers: formerFactionMembers.length,
      pendingApplications: pendingApps.count ?? 0,
      activeDonations: activeDonations.count ?? 0,
      inactiveCount: inactiveFactionMembers.length,
    },
    inactiveMembers: inactiveFactionMembers,
    recentWarnings: recentWarnings.data ?? [],
    recentApplications: recentApps.data ?? [],
    recentDonations: recentDonations.data ?? [],
    topContributors,
    staffActivity: staffActivity.data ?? [],
    applicationsTimeline,
    applicationsStats: {
      total: totalApps,
      accepted: totalAccepted,
      rejected: totalRejected,
      acceptanceRate,
    },
  };
});

// ============================================================
// Inactivité multi-seuils (7/14/30j) via snapshots
// ============================================================

type InactiveBucketMember = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  arrival_date: string | null;
  mc_uuid: string | null;
  messages_total: number;
  voice_total_seconds: number;
  last_activity_at: string | null;
};

export const getInactivityBuckets = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const now = Date.now();
  const since30dIso = new Date(now - 31 * 86_400_000).toISOString();

  const [activeRes, snapshotsRes] = await Promise.all([
    db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid, messages_7d, voice_7d_seconds, messages_total, voice_total_seconds, updated_at",
      )
      .eq("status", "active"),
    db
      .from("leaderboard_snapshots")
      .select("discord_id, taken_at, messages_total, voice_total_seconds")
      .gte("taken_at", since30dIso)
      .order("taken_at", { ascending: true })
      .limit(200_000),
  ]);

  const active = filterFactionMembers(activeRes.data ?? []);

  // For each member, keep the EARLIEST snapshot at or after each threshold.
  // We want the oldest snapshot within the last 14d (to detect 14j inactivity)
  // and the oldest within the last 30d.
  const cutoff14 = now - 14 * 86_400_000;
  const cutoff30 = now - 30 * 86_400_000;
  const earliest14 = new Map<string, { messages: number; voice: number }>();
  const earliest30 = new Map<string, { messages: number; voice: number }>();

  for (const row of (snapshotsRes.data ?? []) as Array<{
    discord_id: string;
    taken_at: string;
    messages_total: number;
    voice_total_seconds: number;
  }>) {
    const t = new Date(row.taken_at).getTime();
    if (t >= cutoff30 && !earliest30.has(row.discord_id)) {
      earliest30.set(row.discord_id, {
        messages: row.messages_total,
        voice: row.voice_total_seconds,
      });
    }
    if (t >= cutoff14 && !earliest14.has(row.discord_id)) {
      earliest14.set(row.discord_id, {
        messages: row.messages_total,
        voice: row.voice_total_seconds,
      });
    }
  }

  const d7: InactiveBucketMember[] = [];
  const d14: InactiveBucketMember[] = [];
  const d30: InactiveBucketMember[] = [];

  for (const m of active) {
    const base: InactiveBucketMember = {
      discord_id: m.discord_id,
      discord_username: m.discord_username ?? null,
      ig_name: m.ig_name ?? null,
      avatar_url: m.avatar_url ?? null,
      current_grade: m.current_grade ?? null,
      arrival_date: m.arrival_date ?? null,
      mc_uuid: m.mc_uuid ?? null,
      messages_total: m.messages_total ?? 0,
      voice_total_seconds: m.voice_total_seconds ?? 0,
      last_activity_at: m.updated_at ?? null,
    };

    const inactive7 = (m.messages_7d ?? 0) === 0 && (m.voice_7d_seconds ?? 0) === 0;
    if (!inactive7) continue;
    d7.push(base);

    const ref14 = earliest14.get(m.discord_id);
    if (ref14) {
      const dMsg = (m.messages_total ?? 0) - ref14.messages;
      const dVoice = (m.voice_total_seconds ?? 0) - ref14.voice;
      if (dMsg <= 0 && dVoice <= 0) d14.push(base);
    }
    const ref30 = earliest30.get(m.discord_id);
    if (ref30) {
      const dMsg = (m.messages_total ?? 0) - ref30.messages;
      const dVoice = (m.voice_total_seconds ?? 0) - ref30.voice;
      if (dMsg <= 0 && dVoice <= 0) d30.push(base);
    }
  }

  const sortByName = (a: InactiveBucketMember, b: InactiveBucketMember) =>
    (a.ig_name ?? a.discord_username ?? "").localeCompare(b.ig_name ?? b.discord_username ?? "");
  d7.sort(sortByName);
  d14.sort(sortByName);
  d30.sort(sortByName);

  return { d7, d14, d30 };
});

// ============================================================
// Membres faction privée jamais connectés au site
// ============================================================

export const getNeverConnectedMembers = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  // Import dynamique pour garder le bundle léger côté client.
  const { listAllGuildMembers } = await import("@/lib/discord/api.server");
  const { GUILDS } = await import("@/lib/discord/constants");

  // 1) Source de vérité : humains réellement présents sur le Discord privé.
  let guildMembers: Awaited<ReturnType<typeof listAllGuildMembers>> = [];
  try {
    guildMembers = await listAllGuildMembers(GUILDS.FACTION);
  } catch (e) {
    await db.from("logs").insert({
      level: "error",
      action: "never_connected_fetch_failed",
      payload: { error: (e as Error).message } as never,
    });
    throw e;
  }

  const factionIds: string[] = [];
  const nickByDiscord = new Map<string, string>();
  const avatarByDiscord = new Map<string, string | null>();
  for (const gm of guildMembers) {
    const uid = gm.user?.id;
    if (!uid) continue;
    if ((gm.user as { bot?: boolean } | undefined)?.bot) continue;
    factionIds.push(uid);
    nickByDiscord.set(uid, gm.nick || gm.user?.global_name || gm.user?.username || uid);
    avatarByDiscord.set(
      uid,
      gm.user?.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${gm.user.avatar}.png` : null,
    );
  }

  // 2) Logins connus (table logs).
  const { data: loginsRes } = await db
    .from("logs")
    .select("actor_discord_id")
    .eq("action", "login")
    .not("actor_discord_id", "is", null)
    .limit(100_000);
  const connected = new Set<string>();
  for (const row of (loginsRes ?? []) as Array<{ actor_discord_id: string | null }>) {
    if (row.actor_discord_id) connected.add(row.actor_discord_id);
  }

  // 3) Enrichissement depuis la table members (chunks pour éviter URL trop longues).
  const dbMap = new Map<
    string,
    {
      discord_username: string | null;
      ig_name: string | null;
      avatar_url: string | null;
      current_grade: string | null;
    }
  >();
  const chunkSize = 200;
  for (let i = 0; i < factionIds.length; i += chunkSize) {
    const chunk = factionIds.slice(i, i + chunkSize);
    const { data } = await db
      .from("members")
      .select("discord_id, discord_username, ig_name, avatar_url, current_grade")
      .in("discord_id", chunk);
    for (const m of data ?? []) {
      dbMap.set(m.discord_id as string, {
        discord_username: (m as { discord_username: string | null }).discord_username ?? null,
        ig_name: (m as { ig_name: string | null }).ig_name ?? null,
        avatar_url: (m as { avatar_url: string | null }).avatar_url ?? null,
        current_grade: (m as { current_grade: string | null }).current_grade ?? null,
      });
    }
  }

  const neverConnected = factionIds
    .filter((id) => !connected.has(id))
    .map((id) => {
      const row = dbMap.get(id);
      return {
        discord_id: id,
        discord_username: row?.discord_username ?? nickByDiscord.get(id) ?? null,
        ig_name: row?.ig_name ?? null,
        avatar_url: row?.avatar_url ?? avatarByDiscord.get(id) ?? null,
        current_grade: row?.current_grade ?? null,
        arrival_date: null as string | null,
        mc_uuid: null as string | null,
      };
    })
    .sort((a, b) =>
      (a.ig_name ?? a.discord_username ?? "").localeCompare(
        b.ig_name ?? b.discord_username ?? "",
      ),
    );

  return { members: neverConnected, total: neverConnected.length };
});

// ============================================================
// Membres faction sans pseudo Minecraft lié
// ============================================================

export const getMembersWithoutMc = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const { data, error } = await db
    .from("members")
    .select(
      "discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid",
    )
    .eq("status", "active")
    .is("mc_uuid", null);
  if (error) throw new Error(error.message);

  // Garde les vrais membres faction (au moins ig_name ou grade ou arrivée renseignés)
  const members = filterFactionMembers(data ?? []).sort((a, b) =>
    (a.ig_name ?? a.discord_username ?? "").localeCompare(
      b.ig_name ?? b.discord_username ?? "",
    ),
  );
  return { members, total: members.length };
});

// Lier / corriger le pseudo Minecraft d'un membre (staff)
import { z as _zStaffMc } from "zod";
import { logAction as _logActionMc } from "@/lib/auth/require.server";

function _normalizeUuidStaff(id: string): string {
  const stripped = id.replace(/-/g, "");
  if (stripped.length !== 32) return id;
  return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
}

const _setMcSchema = _zStaffMc.object({
  memberDiscordId: _zStaffMc.string().regex(/^\d{5,32}$/, "Discord ID invalide"),
  igName: _zStaffMc
    .string()
    .trim()
    .min(3, "Pseudo trop court")
    .max(16, "Max 16 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
});

export const setMemberMcByStaff = createServerFn({ method: "POST" })
  .inputValidator((input) => _setMcSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("members.view");

    // Mojang lookup
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(data.igName)}`,
    );
    if (res.status === 404) throw new Error("Ce pseudo Minecraft n'existe pas.");
    if (!res.ok) throw new Error("Impossible de vérifier le pseudo (API Mojang).");
    const body = (await res.json()) as { id?: string; name?: string };
    if (!body.id || !body.name) throw new Error("Réponse Mojang invalide.");
    const mcUuid = _normalizeUuidStaff(body.id);

    // S'assurer que le membre existe
    const existing = await db
      .from("members")
      .select("discord_id")
      .eq("discord_id", data.memberDiscordId)
      .maybeSingle();
    if (!existing.data) throw new Error("Membre introuvable");

    const upd = await db
      .from("members")
      .update({ ig_name: body.name, mc_uuid: mcUuid })
      .eq("discord_id", data.memberDiscordId);
    if (upd.error) throw new Error(upd.error.message);

    // Best-effort tracked players upsert
    try {
      const nowIso = new Date().toISOString();
      const { data: tracked } = await db
        .from("paladium_tracked_players")
        .select("uuid")
        .eq("uuid", mcUuid)
        .maybeSingle();
      if (!tracked) {
        await db.from("paladium_tracked_players").insert({
          uuid: mcUuid,
          username: body.name,
          search_count: 0,
          first_searched_at: nowIso,
          last_searched_at: nowIso,
        });
      } else {
        await db
          .from("paladium_tracked_players")
          .update({ username: body.name })
          .eq("uuid", mcUuid);
      }
    } catch {
      /* ignore */
    }

    await _logActionMc("member_mc_link_staff", staff.discordId, {
      member: data.memberDiscordId,
      ig_name: body.name,
    });

    return { ok: true, igName: body.name, mcUuid };
  });
