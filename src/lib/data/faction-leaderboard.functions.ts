import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";

export type FactionLeaderboardEntry = {
  mc_uuid: string;
  ig_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  money: number | null;
  level: number | null; // niveau global Paladium depuis paladium_player_cache
  jobs: Record<string, number>; // ex: { "miner": 12, "farmer": 8 }
  snapshot_at: string | null; // date du dernier snapshot mc_player_stats
};

type RawJobEntry = { name?: unknown; level?: unknown; xp?: unknown; experience?: unknown };

function parseJobs(raw: unknown): Record<string, number> {
  if (!Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const item of raw as RawJobEntry[]) {
    if (typeof item?.name === "string" && typeof item?.level === "number") {
      result[item.name.toLowerCase()] = item.level;
    }
  }
  return result;
}

export const getFactionIngameLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ entries: FactionLeaderboardEntry[] }> => {
    await requireSession();

    // 1. Membres actifs avec mc_uuid
    const { data: members, error: membersError } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, mc_uuid, current_grade, avatar_url")
      .eq("status", "active")
      .not("mc_uuid", "is", null);

    if (membersError) throw new Error(`members fetch failed: ${membersError.message}`);
    if (!members || members.length === 0) return { entries: [] };

    const uuids = members.map((m) => m.mc_uuid as string);

    // 2. Snapshots mc_player_stats — un seul SELECT, dédupliqué côté JS
    const { data: snapshots, error: snapshotsError } = await db
      .from("mc_player_stats")
      .select("mc_uuid, money, jobs, snapshot_at")
      .in("mc_uuid", uuids)
      .order("snapshot_at", { ascending: false })
      .limit(uuids.length * 5);

    if (snapshotsError) throw new Error(`mc_player_stats fetch failed: ${snapshotsError.message}`);

    // Garder uniquement le snapshot le plus récent par mc_uuid (1er dans l'ordre desc)
    const latestSnapshot = new Map<
      string,
      { money: number | null; jobs: unknown; snapshot_at: string | null }
    >();
    for (const row of snapshots ?? []) {
      if (!latestSnapshot.has(row.mc_uuid)) {
        latestSnapshot.set(row.mc_uuid, {
          money: row.money != null ? Number(row.money) : null,
          jobs: row.jobs,
          snapshot_at: row.snapshot_at ?? null,
        });
      }
    }

    // 3. Niveaux Paladium depuis paladium_player_cache
    const { data: cacheRows, error: cacheError } = await db
      .from("paladium_player_cache")
      .select("mc_uuid, profile_json")
      .in("mc_uuid", uuids);

    if (cacheError) throw new Error(`paladium_player_cache fetch failed: ${cacheError.message}`);

    const levelByUuid = new Map<string, number | null>();
    for (const row of cacheRows ?? []) {
      const lvl = (row.profile_json as Record<string, unknown>)?.level;
      levelByUuid.set(row.mc_uuid, typeof lvl === "number" ? lvl : null);
    }

    // 4. Assembler les entries
    const entries: FactionLeaderboardEntry[] = members.map((m) => {
      const uuid = m.mc_uuid as string;
      const snap = latestSnapshot.get(uuid);
      return {
        mc_uuid: uuid,
        ig_name: m.ig_name ?? null,
        discord_username: m.discord_username ?? null,
        avatar_url: m.avatar_url ?? null,
        current_grade: m.current_grade ?? null,
        money: snap?.money ?? null,
        level: levelByUuid.get(uuid) ?? null,
        jobs: snap ? parseJobs(snap.jobs) : {},
        snapshot_at: snap?.snapshot_at ?? null,
      };
    });

    // Tri par money desc (le tri final est géré côté UI)
    entries.sort((a, b) => {
      if (a.money === null && b.money === null) return 0;
      if (a.money === null) return 1;
      if (b.money === null) return -1;
      return b.money - a.money;
    });

    return { entries };
  },
);
