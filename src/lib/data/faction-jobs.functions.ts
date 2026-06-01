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

export const getFactionJobs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ members: FactionJobMember[]; jobNames: string[] }> => {
    await requirePermission("profile.self");

    const { data: members, error } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username, avatar_url, mc_uuid")
      .eq("status", "active")
      .not("mc_uuid", "is", null);
    if (error) throw new Error(error.message);

    const uuids = (members ?? []).map((m) => m.mc_uuid).filter(Boolean) as string[];
    if (uuids.length === 0) return { members: [], jobNames: [] };

    const { data: stats, error: sErr } = await db
      .from("mc_player_stats")
      .select("mc_uuid, jobs, snapshot_at")
      .in("mc_uuid", uuids)
      .order("snapshot_at", { ascending: false })
      .limit(2000);
    if (sErr) throw new Error(sErr.message);

    const latest = new Map<string, { jobs: JobEntry[]; snapshot_at: string }>();
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

    const jobSet = new Set<string>();
    const out: FactionJobMember[] = (members ?? []).map((m) => {
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

    return { members: out, jobNames: Array.from(jobSet).sort() };
  },
);
