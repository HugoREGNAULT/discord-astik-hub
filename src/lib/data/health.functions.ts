import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { filterFactionMembers, isFactionMember } from "@/lib/data/faction-members";

/**
 * Dashboard "Santé faction" : indicateurs synthétiques de l'activité et
 * du turnover, plus les top recruteurs sur la période.
 * Lecture réservée aux personnes ayant `members.view`.
 */
export const getFactionHealth = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const now = Date.now();
  const since30dIso = new Date(now - 30 * 86_400_000).toISOString();
  const since90dIso = new Date(now - 90 * 86_400_000).toISOString();
  const since30dDate = since30dIso.slice(0, 10);
  const since90dDate = since90dIso.slice(0, 10);
  const todayDate = new Date(now).toISOString().slice(0, 10);

  const [activeMembers, snapshots, recentArrivals, recentDepartures, absences] = await Promise.all([
    db
      .from("members")
      .select(
        "discord_id, recruiter_discord_id, messages_7d, voice_7d_seconds, arrival_date, ig_name, current_grade, mc_uuid",
      )
      .eq("status", "active"),
    db
      .from("leaderboard_snapshots")
      .select("discord_id, taken_at, messages_7d, voice_7d_seconds")
      .gte("taken_at", since90dIso)
      .order("taken_at", { ascending: true })
      .limit(200_000),
    db
      .from("members")
      .select(
        "discord_id, ig_name, discord_username, avatar_url, arrival_date, recruiter_discord_id, current_grade, mc_uuid",
      )
      .gte("arrival_date", since30dDate)
      .order("arrival_date", { ascending: false }),
    db
      .from("members")
      .select(
        "discord_id, ig_name, discord_username, updated_at, status, current_grade, arrival_date, mc_uuid",
      )
      .eq("status", "former")
      .gte("updated_at", since30dIso)
      .order("updated_at", { ascending: false }),
    // Absences déclarées qui chevauchent la fenêtre 90j (pour la courbe "absents/jour")
    db
      .from("absences")
      .select("member_discord_id, starts_on, ends_on")
      .lte("starts_on", todayDate)
      .gte("ends_on", since90dDate),
  ]);

  const active = (activeMembers.data ?? []).filter((member) => isFactionMember(member));
  const total = active.length;
  const activeCount = active.filter(
    (m) => (m.messages_7d ?? 0) > 0 || (m.voice_7d_seconds ?? 0) > 0,
  ).length;
  const activityRate = total > 0 ? Math.round((activeCount / total) * 100) : 0;

  // Evolution par jour (90j) : effectif présent, inactifs, absents déclarés.
  //  - présents : discord_id distincts ayant un snapshot ce jour-là
  //  - inactifs : parmi eux, ceux dont le snapshot du jour a 0 message ET 0 vocal
  //    (on garde le dernier snapshot du jour, les snapshots sont triés croissants)
  //  - absents  : membres couverts par une absence déclarée ce jour-là
  const days: string[] = [];
  for (let i = 89; i >= 0; i--) {
    days.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  }
  const presentByDay = new Map<string, Set<string>>();
  const inactiveByDay = new Map<string, Map<string, boolean>>();
  for (const d of days) {
    presentByDay.set(d, new Set());
    inactiveByDay.set(d, new Map());
  }
  for (const s of (snapshots.data ?? []) as Array<{
    discord_id: string;
    taken_at: string;
    messages_7d: number | null;
    voice_7d_seconds: number | null;
  }>) {
    const key = s.taken_at.slice(0, 10);
    const present = presentByDay.get(key);
    if (!present) continue;
    present.add(s.discord_id);
    inactiveByDay
      .get(key)!
      .set(s.discord_id, (s.messages_7d ?? 0) === 0 && (s.voice_7d_seconds ?? 0) === 0);
  }

  const absenceRows = (absences.data ?? []) as Array<{
    member_discord_id: string;
    starts_on: string;
    ends_on: string;
  }>;
  const absentCountOn = (d: string) => {
    const set = new Set<string>();
    for (const a of absenceRows) {
      if (a.starts_on <= d && a.ends_on >= d) set.add(a.member_discord_id);
    }
    return set.size;
  };

  const evolution = days.map((date) => {
    let inactive = 0;
    for (const v of inactiveByDay.get(date)!.values()) if (v) inactive++;
    return {
      date,
      count: presentByDay.get(date)!.size,
      inactive,
      absent: absentCountOn(date),
    };
  });

  // Top recruteurs sur les 30 et 90 derniers jours (depuis arrival_date)
  const recruiters30 = new Map<string, number>();
  const recruiters90 = new Map<string, number>();
  // recentArrivals : 30j seulement, on relance pour 90j via filter sur active
  for (const m of recentArrivals.data ?? []) {
    if (m.recruiter_discord_id) {
      recruiters30.set(m.recruiter_discord_id, (recruiters30.get(m.recruiter_discord_id) ?? 0) + 1);
    }
  }
  for (const m of active) {
    if (m.recruiter_discord_id && m.arrival_date && m.arrival_date >= since90dDate) {
      recruiters90.set(m.recruiter_discord_id, (recruiters90.get(m.recruiter_discord_id) ?? 0) + 1);
    }
  }
  const topRecruiterIds = Array.from(new Set([...recruiters30.keys(), ...recruiters90.keys()]));
  let recruiterMap = new Map<
    string,
    { ig_name: string | null; discord_username: string | null; avatar_url: string | null }
  >();
  if (topRecruiterIds.length > 0) {
    const { data: recs } = await db
      .from("members")
      .select(
        "discord_id, ig_name, discord_username, avatar_url, current_grade, arrival_date, mc_uuid",
      )
      .in("discord_id", topRecruiterIds);
    recruiterMap = new Map(
      (recs ?? [])
        .filter((member) => isFactionMember(member))
        .map((r) => [
          r.discord_id,
          { ig_name: r.ig_name, discord_username: r.discord_username, avatar_url: r.avatar_url },
        ]),
    );
  }
  const topRecruiters = Array.from(recruiters90.entries())
    .map(([id, count90]) => ({
      discord_id: id,
      count_30d: recruiters30.get(id) ?? 0,
      count_90d: count90,
      ...recruiterMap.get(id),
    }))
    .filter((recruiter) => recruiter.ig_name || recruiter.discord_username)
    .sort((a, b) => b.count_90d - a.count_90d)
    .slice(0, 6);

  const factionArrivals = filterFactionMembers(recentArrivals.data ?? []);
  const factionDepartures = filterFactionMembers(recentDepartures.data ?? []);
  const arrivals30 = factionArrivals.length;
  const departures30 = factionDepartures.length;
  const turnoverRate = total > 0 ? Math.round(((arrivals30 + departures30) / total) * 100) : 0;
  const netGrowth30 = arrivals30 - departures30;

  return {
    summary: {
      activeMembers: total,
      activityRate,
      arrivals30,
      departures30,
      netGrowth30,
      turnoverRate,
    },
    evolution,
    topRecruiters,
    recentArrivals: factionArrivals.slice(0, 8),
    recentDepartures: factionDepartures.slice(0, 8),
  };
});
