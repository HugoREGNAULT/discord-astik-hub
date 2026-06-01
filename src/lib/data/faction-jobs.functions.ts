import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

export type JobEntry = { name: string; level: number };
export type FactionJobMember = {
  discord_id: string;
  ig_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  mc_uuid: string;
  snapshot_at: string | null;
  jobs: JobEntry[];
};

export type JobAnomaly = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  kind: "no_mc_link" | "never_synced" | "stale_snapshot" | "no_jobs";
  detail: string;
};

export type FactionJobsResult = {
  members: FactionJobMember[];
  jobNames: string[];
  anomalies: JobAnomaly[];
  stats: {
    total_active: number;
    linked: number;
    with_snapshot: number;
    latest_snapshot_at: string | null;
  };
};

export const getFactionJobs = createServerFn({ method: "GET" }).handler(
  async (): Promise<FactionJobsResult> => {
    await requirePermission("profile.self");

    const { data: allMembers, error: amErr } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, avatar_url, mc_uuid")
      .eq("status", "active");
    if (amErr) throw new Error(amErr.message);

    const linked = (allMembers ?? []).filter((m) => m.mc_uuid);
    const uuids = linked.map((m) => m.mc_uuid!) as string[];

    const latest = new Map<string, { jobs: JobEntry[]; snapshot_at: string }>();
    if (uuids.length > 0) {
      const { data: stats, error: sErr } = await db
        .from("mc_player_stats")
        .select("mc_uuid, jobs, snapshot_at")
        .in("mc_uuid", uuids)
        .order("snapshot_at", { ascending: false })
        .limit(2000);
      if (sErr) throw new Error(sErr.message);

      for (const row of stats ?? []) {
        if (!row.mc_uuid || latest.has(row.mc_uuid)) continue;
        const jobs = Array.isArray(row.jobs)
          ? (row.jobs as unknown[]).map((j) => {
              const o = j as { name?: unknown; level?: unknown };
              return { name: String(o.name ?? ""), level: Number(o.level ?? 0) };
            })
          : [];
        latest.set(row.mc_uuid, { jobs, snapshot_at: row.snapshot_at as string });
      }
    }

    const jobSet = new Set<string>();
    const out: FactionJobMember[] = linked.map((m) => {
      const s = latest.get(m.mc_uuid!);
      const jobs = s?.jobs ?? [];
      for (const j of jobs) if (j.name) jobSet.add(j.name);
      return {
        discord_id: m.discord_id,
        ig_name: m.ig_name,
        discord_username: m.discord_username,
        avatar_url: m.avatar_url,
        mc_uuid: m.mc_uuid!,
        snapshot_at: s?.snapshot_at ?? null,
        jobs,
      };
    });

    // ============ Détection d'anomalies ============
    const anomalies: JobAnomaly[] = [];
    const STALE_MS = 24 * 60 * 60 * 1000; // 24h
    const now = Date.now();

    for (const m of allMembers ?? []) {
      if (!m.mc_uuid) {
        anomalies.push({
          discord_id: m.discord_id,
          discord_username: m.discord_username,
          ig_name: m.ig_name,
          avatar_url: m.avatar_url,
          kind: "no_mc_link",
          detail: "Aucun pseudo Minecraft lié",
        });
        continue;
      }
      const s = latest.get(m.mc_uuid);
      if (!s) {
        anomalies.push({
          discord_id: m.discord_id,
          discord_username: m.discord_username,
          ig_name: m.ig_name,
          avatar_url: m.avatar_url,
          kind: "never_synced",
          detail: "Compte lié mais jamais synchronisé via l'API Paladium",
        });
        continue;
      }
      const ageMs = now - new Date(s.snapshot_at).getTime();
      if (ageMs > STALE_MS) {
        const hours = Math.floor(ageMs / (60 * 60 * 1000));
        anomalies.push({
          discord_id: m.discord_id,
          discord_username: m.discord_username,
          ig_name: m.ig_name,
          avatar_url: m.avatar_url,
          kind: "stale_snapshot",
          detail: `Dernier snapshot il y a ${hours}h`,
        });
      } else if (s.jobs.length === 0) {
        anomalies.push({
          discord_id: m.discord_id,
          discord_username: m.discord_username,
          ig_name: m.ig_name,
          avatar_url: m.avatar_url,
          kind: "no_jobs",
          detail: "Snapshot récent mais aucun métier remonté",
        });
      }
    }

    const order: Record<JobAnomaly["kind"], number> = {
      no_mc_link: 0,
      never_synced: 1,
      stale_snapshot: 2,
      no_jobs: 3,
    };
    anomalies.sort((a, b) => order[a.kind] - order[b.kind]);

    const latestSnapshotAt =
      Array.from(latest.values())
        .map((v) => v.snapshot_at)
        .sort()
        .reverse()[0] ?? null;

    return {
      members: out,
      jobNames: Array.from(jobSet).sort(),
      anomalies,
      stats: {
        total_active: (allMembers ?? []).length,
        linked: linked.length,
        with_snapshot: latest.size,
        latest_snapshot_at: latestSnapshotAt,
      },
    };
  },
);
