import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { fetchPaladium, dashUuid } from "@/lib/paladium/paladium.server";
import type { Json } from "@/integrations/supabase/types";

export type FactionLeaderboardEntry = {
  discord_id: string;
  ig_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  mc_uuid: string;
  money: number | null;
  level: number | null;
  miner: number | null;
  farmer: number | null;
  hunter: number | null;
  alchemist: number | null;
  clicker: number | null;
  cached_at: string | null;
};

export type FactionNoUuidEntry = {
  discord_id: string;
  ig_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  current_grade: string | null;
};

export const refreshFactionMemberStats = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ refreshed: number; skipped: number; failed: number }> => {
    const user = await requirePermission("admin.access");

    // 1. Fetch membres actifs avec mc_uuid
    const { data: members, error: membersError } = await db
      .from("members")
      .select("discord_id, mc_uuid, ig_name")
      .eq("status", "active")
      .not("mc_uuid", "is", null);

    if (membersError) throw new Error(`members fetch failed: ${membersError.message}`);
    if (!members || members.length === 0) return { refreshed: 0, skipped: 0, failed: 0 };

    const uuids = members.map((m) => m.mc_uuid as string);

    // 2. Fetch cache existant pour vérifier fraîcheur
    const { data: cacheRows, error: cacheError } = await db
      .from("paladium_player_cache")
      .select("mc_uuid, fetched_at")
      .in("mc_uuid", uuids);

    if (cacheError) throw new Error(`paladium_player_cache fetch failed: ${cacheError.message}`);

    const cacheMap = new Map<string, string | null>();
    for (const row of cacheRows ?? []) {
      cacheMap.set(row.mc_uuid, row.fetched_at ?? null);
    }

    let refreshed = 0;
    let skipped = 0;
    let failed = 0;

    // 3. Pour chaque membre : séquentiel pour respecter les rate limits
    for (const m of members) {
      const rawUuid = m.mc_uuid as string;
      const uuid = dashUuid(rawUuid);
      const fetchedAt = cacheMap.get(rawUuid) ?? cacheMap.get(uuid) ?? null;

      // TTL : 3600s
      if (fetchedAt && Date.now() - new Date(fetchedAt).getTime() < 3_600_000) {
        skipped++;
        continue;
      }

      try {
        const [profileRes, jobsRes, clickerRes] = await Promise.all([
          fetchPaladium(`/v1/paladium/player/profile/${uuid}`),
          fetchPaladium(`/v1/paladium/player/profile/${uuid}/jobs`),
          fetchPaladium(`/v1/paladium/player/profile/${uuid}/clicker`),
        ]);

        await db.from("paladium_player_cache").upsert({
          mc_uuid: uuid,
          profile_json: profileRes.data as Json,
          jobs_json: { jobs: jobsRes.data, clicker: clickerRes.data } as unknown as Json,
          fetched_at: new Date().toISOString(),
        });

        refreshed++;
      } catch {
        failed++;
      }
    }

    await logAction("faction_stats_refresh", user.discordId, { refreshed, skipped, failed });

    return { refreshed, skipped, failed };
  },
);

export const getFactionLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ entries: FactionLeaderboardEntry[]; withoutUuid: FactionNoUuidEntry[] }> => {
    await requireSession();

    // 1. Fetch TOUS les membres actifs (avec ET sans mc_uuid)
    const { data: members, error: membersError } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, mc_uuid, current_grade, avatar_url")
      .eq("status", "active")
      .order("ig_name", { ascending: true, nullsFirst: false });

    if (membersError) throw new Error(`members fetch failed: ${membersError.message}`);
    if (!members || members.length === 0) return { entries: [], withoutUuid: [] };

    // 2. Séparer avec/sans uuid
    const withUuid = members.filter((m) => m.mc_uuid != null);
    const withoutUuid: FactionNoUuidEntry[] = members
      .filter((m) => m.mc_uuid == null)
      .map((m) => ({
        discord_id: m.discord_id,
        ig_name: m.ig_name ?? null,
        discord_username: m.discord_username ?? null,
        avatar_url: m.avatar_url ?? null,
        current_grade: m.current_grade ?? null,
      }));

    if (withUuid.length === 0) return { entries: [], withoutUuid };

    // Normaliser les UUIDs avant la recherche en cache
    const normalizedUuids = withUuid.map((m) => dashUuid(m.mc_uuid as string));

    // 3. Fetch cache pour ceux avec uuid
    const { data: cacheRows, error: cacheError } = await db
      .from("paladium_player_cache")
      .select("mc_uuid, profile_json, jobs_json, fetched_at")
      .in("mc_uuid", normalizedUuids);

    if (cacheError) throw new Error(`paladium_player_cache fetch failed: ${cacheError.message}`);

    const cacheMap = new Map<
      string,
      { profile_json: unknown; jobs_json: unknown; fetched_at: string | null }
    >();
    for (const row of cacheRows ?? []) {
      cacheMap.set(row.mc_uuid, {
        profile_json: row.profile_json,
        jobs_json: row.jobs_json,
        fetched_at: row.fetched_at ?? null,
      });
    }

    // 4. Parser chaque membre avec uuid
    const entries: FactionLeaderboardEntry[] = withUuid.map((m) => {
      const uuid = dashUuid(m.mc_uuid as string);
      const cacheRow = cacheMap.get(uuid) ?? null;

      // profile_json : { money?: number, level?: number, ... }
      const profile = (cacheRow?.profile_json as Record<string, unknown> | null) ?? null;
      const money = typeof profile?.money === "number" ? profile.money : null;
      const level = typeof profile?.level === "number" ? profile.level : null;

      // jobs_json : { jobs: { miner: {level, xp}, farmer: {level, xp}, ... }, clicker: { rps, ... } }
      const jobsWrapper = (cacheRow?.jobs_json as Record<string, unknown> | null) ?? null;
      const jobsObj = (jobsWrapper?.jobs as Record<string, Record<string, unknown>> | null) ?? null;
      const getJobLevel = (name: string): number | null => {
        const lvl = jobsObj?.[name]?.level;
        return typeof lvl === "number" ? lvl : null;
      };
      const clickerData = (jobsWrapper?.clicker as Record<string, unknown> | null) ?? null;
      const clicker = typeof clickerData?.rps === "number" ? clickerData.rps : null;

      return {
        discord_id: m.discord_id,
        ig_name: m.ig_name ?? null,
        discord_username: m.discord_username ?? null,
        avatar_url: m.avatar_url ?? null,
        current_grade: m.current_grade ?? null,
        mc_uuid: uuid,
        money,
        level,
        miner: getJobLevel("miner"),
        farmer: getJobLevel("farmer"),
        hunter: getJobLevel("hunter"),
        alchemist: getJobLevel("alchemist"),
        clicker,
        cached_at: cacheRow?.fetched_at ?? null,
      };
    });

    return { entries, withoutUuid };
  },
);
