/**
 * Hook cron : import continu des stats Paladium pour les membres dont
 * le compte Minecraft est vérifié (mc_uuid renseigné).
 *
 * Fréquence conseillée : toutes les 6h (cf. migration accompagnante)
 * pour rester très en deçà du rate-limit Paladium.
 *
 * Étapes :
 *  1. liste des membres actifs avec mc_uuid
 *  2. pour chacun : fetchPaladium player/profile + jobs (tolérant aux 429)
 *  3. upsert snapshot dans mc_player_stats
 *  4. lance la détection d'alts par corrélation et crée des anomaly_flags
 *     `alt_transfer` (sévérité low/medium) en cas de suspicion — JAMAIS
 *     d'action automatique (warn/ban/retrait de points).
 *
 * Auth : `x-bot-key` (BOT_API_KEY) — pattern scan-anomalies.ts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { db } from "@/lib/db.server";
import { fetchPaladium } from "@/lib/paladium/paladium.server";

interface PlayerProfile {
  uuid?: string;
  username?: string;
  factionName?: string | null;
  money?: number;
  level?: number;
  [k: string]: unknown;
}
/**
 * Forme réelle de l'API Paladium `/v1/paladium/player/profile/{uuid}/jobs` :
 *   { alchemist: { level, xp }, farmer: { level, xp }, hunter: {...}, miner: {...} }
 * (objet indexé par nom de métier, et NON pas `{ jobs: [...] }`).
 */
type PlayerJobsResponse = Record<string, { level?: number; xp?: number } | undefined>;

interface SnapshotRow {
  member_discord_id: string;
  mc_uuid: string;
  money: number | null;
  jobs: Array<{ name: string; level: number; xp?: number }>;
  faction_ingame: string | null;
  raw: unknown;
}

async function importOne(
  discordId: string,
  mc_uuid: string,
): Promise<{ ok: boolean; snapshot?: SnapshotRow; reason?: string }> {
  let profile: PlayerProfile | null = null;
  let jobsRaw: PlayerJobsResponse = {};

  try {
    const pres = await fetchPaladium(`/v1/paladium/player/profile/${mc_uuid}`);
    profile = (pres.data ?? null) as PlayerProfile | null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429/.test(msg)) return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: msg };
  }
  if (!profile) return { ok: false, reason: "no_profile" };

  try {
    const jres = await fetchPaladium(`/v1/paladium/player/profile/${mc_uuid}/jobs`);
    jobsRaw = (jres.data ?? {}) as PlayerJobsResponse;
  } catch {
    // Tolérant : si jobs échoue, on garde au moins le profil.
  }

  // L'API peut renvoyer soit { alchemist: {level,xp}, ... } (forme officielle),
  // soit (au cas où) { jobs: [{name,level,experience}] } pour rester compatible.
  const jobList: Array<{ name: string; level: number; xp?: number }> = [];
  const legacyArr = (jobsRaw as unknown as { jobs?: Array<{ name: string; level: number; experience?: number; xp?: number }> }).jobs;
  if (Array.isArray(legacyArr)) {
    for (const j of legacyArr) {
      if (!j?.name) continue;
      jobList.push({
        name: String(j.name).toLowerCase(),
        level: Number(j.level ?? 0),
        xp: Number(j.xp ?? j.experience ?? 0),
      });
    }
  } else if (jobsRaw && typeof jobsRaw === "object") {
    for (const [name, v] of Object.entries(jobsRaw)) {
      if (!v || typeof v !== "object") continue;
      jobList.push({
        name: name.toLowerCase(),
        level: Number((v as { level?: number }).level ?? 0),
        xp: Number((v as { xp?: number }).xp ?? 0),
      });
    }
  }


  const snapshot: SnapshotRow = {
    member_discord_id: discordId,
    mc_uuid,
    money: typeof profile.money === "number" ? profile.money : null,
    jobs: jobList,
    faction_ingame: (profile.factionName as string | null) ?? null,
    raw: { profile, jobs },
  };

  const { error } = await db.from("mc_player_stats").insert({
    mc_uuid: snapshot.mc_uuid,
    money: snapshot.money,
    jobs: snapshot.jobs as never,
    faction_ingame: snapshot.faction_ingame,
    raw: snapshot.raw as never,
  });
  if (error) return { ok: false, reason: error.message };

  return { ok: true, snapshot };
}

/* ============ Détection d'alts par corrélation ============
 * Heuristique délibérément CONSERVATIVE : on flag uniquement des coïncidences
 * marquées entre 2 membres distincts (= deux discord_id différents) :
 *   - même faction in-game (non vide)
 *   - écart relatif d'argent ≤ 10 %
 *   - ≥ 3 jobs avec un écart de niveau ≤ 2
 *
 * On NE bloque rien, on NE déclenche AUCUNE action : on crée un
 * anomaly_flags kind='alt_transfer' severity='low' qui sera revu par le
 * staff. Le pipeline scan-anomalies se chargera d'ajouter l'explication
 * IA neutre.
 */
async function detectAlts(snapshots: SnapshotRow[]): Promise<number> {
  // Indexer par faction non vide
  const byFaction = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    if (!s.faction_ingame) continue;
    const key = s.faction_ingame.toLowerCase();
    const arr = byFaction.get(key) ?? [];
    arr.push(s);
    byFaction.set(key, arr);
  }

  let created = 0;

  for (const group of byFaction.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.member_discord_id === b.member_discord_id) continue;

        // Money proche
        const am = a.money ?? 0;
        const bm = b.money ?? 0;
        const max = Math.max(am, bm);
        const moneyClose =
          max > 1000 && Math.abs(am - bm) / Math.max(max, 1) <= 0.1;

        // Jobs corrélés
        const aJobs = new Map(a.jobs.map((j) => [j.name, j.level]));
        let jobMatches = 0;
        for (const bj of b.jobs) {
          const al = aJobs.get(bj.name);
          if (al !== undefined && Math.abs(al - bj.level) <= 2) jobMatches++;
        }
        const jobsClose = jobMatches >= 3;

        if (!moneyClose && !jobsClose) continue;

        // Évite les doublons : un flag ouvert pour cette paire ?
        const pairKey = [a.member_discord_id, b.member_discord_id].sort().join("|");
        const { data: existing } = await db
          .from("anomaly_flags")
          .select("id")
          .eq("kind", "alt_transfer")
          .eq("status", "open")
          .contains("evidence", { pair_key: pairKey } as never)
          .limit(1);
        if (existing && existing.length > 0) continue;

        const score = (moneyClose ? 0.5 : 0) + (jobsClose ? 0.5 : 0);
        const reasons: string[] = [];
        if (moneyClose) reasons.push("écart d'argent < 10 %");
        if (jobsClose) reasons.push(`${jobMatches} jobs à ±2 niveaux`);

        const flagFor = async (target: string, otherMember: string) => {
          const { error } = await db.from("anomaly_flags").insert({
            member_discord_id: target,
            kind: "alt_transfer",
            severity: score >= 0.9 ? "medium" : "low",
            score,
            status: "open",
            evidence: {
              pair_key: pairKey,
              faction_ingame: a.faction_ingame,
              other_member_discord_id: otherMember,
              money: { a: am, b: bm },
              job_matches: jobMatches,
              reasons,
            } as never,
          });
          if (!error) created++;
        };
        await flagFor(a.member_discord_id, b.member_discord_id);
        await flagFor(b.member_discord_id, a.member_discord_id);
      }
    }
  }

  return created;
}

export const Route = createFileRoute("/api/public/hooks/import-mc-stats")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        const { data: members, error } = await db
          .from("members")
          .select("discord_id, mc_uuid")
          .eq("status", "active")
          .not("mc_uuid", "is", null);

        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const snapshots: SnapshotRow[] = [];
        let imported = 0;
        let rate_limited = 0;
        let failed = 0;

        for (const m of members ?? []) {
          if (!m.mc_uuid) continue;
          const r = await importOne(m.discord_id, m.mc_uuid);
          if (r.ok && r.snapshot) {
            snapshots.push(r.snapshot);
            imported++;
          } else if (r.reason === "rate_limited") {
            rate_limited++;
            // Petite pause pour soulager le rate limit
            await new Promise((res) => setTimeout(res, 1500));
          } else {
            failed++;
          }
          // Soft delay entre membres pour rester en deçà du burst
          await new Promise((res) => setTimeout(res, 250));
        }

        const altFlagsCreated = await detectAlts(snapshots);

        return Response.json({
          ok: true,
          imported,
          rate_limited,
          failed,
          alt_flags_created: altFlagsCreated,
        });
      },
    },
  },
});
