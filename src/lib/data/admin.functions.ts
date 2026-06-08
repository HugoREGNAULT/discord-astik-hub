import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";
import { pingDiscord, getGuildMember } from "@/lib/discord/api.server";
import { GUILDS } from "@/lib/discord/constants";

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("admin.access");
  const [membersRes, activeCarts, recentLogs, recentErrors, lastRefresh] = await Promise.all([
    db.from("members").select("discord_id, ig_name, current_grade, arrival_date, mc_uuid"),
    db.from("donations").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("logs").select("*").order("created_at", { ascending: false }).limit(20),
    db
      .from("logs")
      .select("*")
      .eq("level", "error")
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("discord_role_cache")
      .select("refreshed_at")
      .order("refreshed_at", { ascending: false })
      .limit(1),
  ]);

  // Ping Discord API (cache mémoire 30 s, sémaphore + retry)
  const ping = await pingDiscord();

  return {
    profilesCount: filterFactionMembers(membersRes.data ?? []).length,
    activeCarts: activeCarts.count ?? 0,
    recentLogs: recentLogs.data ?? [],
    recentErrors: recentErrors.data ?? [],
    lastRoleRefresh: lastRefresh.data?.[0]?.refreshed_at ?? null,
    discord: { ok: ping.ok, latencyMs: ping.latencyMs },
  };
});

/**
 * Corrige la date d'arrivée de tous les membres faction qui n'en ont pas :
 * on prend la date d'entrée sur le serveur privé (Discord faction `joined_at`).
 * Idempotent — ne touche que les fiches dont `arrival_date` est null.
 */
export const backfillArrivalDates = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requirePermission("admin.access");

  const { data: members, error } = await db
    .from("members")
    .select("discord_id, ig_name, current_grade, mc_uuid")
    .is("arrival_date", null);
  if (error) throw new Error(error.message);

  // On ne corrige que les vrais membres faction (un visiteur connecté n'a pas
  // de « date d'arrivée » pertinente).
  const targets = filterFactionMembers(members ?? []);

  let updated = 0;
  let notFound = 0;
  let failed = 0;

  for (const m of targets) {
    try {
      const gm = await getGuildMember(GUILDS.FACTION, m.discord_id);
      const joinedAt = gm?.joined_at;
      if (!joinedAt) {
        notFound += 1;
        continue;
      }
      const arrivalDate = joinedAt.slice(0, 10); // YYYY-MM-DD
      const { error: upErr } = await db
        .from("members")
        .update({ arrival_date: arrivalDate })
        .eq("discord_id", m.discord_id);
      if (upErr) {
        failed += 1;
        continue;
      }
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  await logAction("backfill_arrival_dates", user.discordId, {
    scanned: targets.length,
    updated,
    notFound,
    failed,
  });

  return { scanned: targets.length, updated, notFound, failed };
});
