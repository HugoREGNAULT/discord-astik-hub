/**
 * Heuristique churn (risque de départ) + cohortes de rétention.
 * Lecture seule, gatée par `members.view`. Aucune IA, aucune décision automatique.
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

const DAY_MS = 86_400_000;

export type ChurnRow = {
  discord_id: string;
  ig_name: string | null;
  discord_username: string | null;
  avatar_url: string | null;
  score: number;
  factors: {
    activity_drop: number; // 0..1 (1 = chute totale 7j vs 30j)
    presence_trend: number; // pente par jour, négative = en baisse
    tenure_days: number;
    messages_7d: number;
    voice_7d_seconds: number;
  };
};

export type ChurnPayload = {
  rows: ChurnRow[];
  computedAt: string;
  formula: string;
};

/**
 * Score 0..100 (plus haut = plus risqué). Combine :
 *   - activity_drop (chute 7j vs moyenne 30j)              poids 50
 *   - presence_trend (pente présence/jour sur 90j)         poids 30
 *   - tenure_bonus (les anciens, moins volatils => -)      poids 20
 * Coefficients ajustables ci-dessous.
 */
const W_DROP = 50;
const W_TREND = 30;
const W_TENURE = 20;

function computeScore(f: ChurnRow["factors"]): number {
  // activity_drop ∈ [0..1]
  const dropPart = Math.max(0, Math.min(1, f.activity_drop)) * W_DROP;
  // presence_trend: -1..1 jour⁻¹ ; on amplifie & on borne
  const trendPart = Math.max(0, Math.min(1, -f.presence_trend * 10)) * W_TREND;
  // tenure : peu d'ancienneté => +risque (jeunes membres plus volatils)
  // 0 jours -> +1 ; 180j+ -> 0
  const tenureRisk = Math.max(0, 1 - f.tenure_days / 180);
  const tenurePart = tenureRisk * W_TENURE;
  return Math.round(dropPart + trendPart + tenurePart);
}

/**
 * Régression linéaire simple y = a + b*x ; renvoie la pente `b`.
 */
function slope(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;
  const n = points.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

export const getChurnRisk = createServerFn({ method: "GET" }).handler(
  async () => {
    await requirePermission("members.view");

    const now = Date.now();
    const since90Iso = new Date(now - 90 * DAY_MS).toISOString();

    const [membersRes, snapsRes] = await Promise.all([
      db
        .from("members")
        .select(
          "discord_id, ig_name, discord_username, avatar_url, messages_7d, voice_7d_seconds, arrival_date",
        )
        .eq("status", "active"),
      db
        .from("leaderboard_snapshots")
        .select("discord_id, taken_at, messages_7d, voice_7d_seconds")
        .gte("taken_at", since90Iso)
        .limit(200_000),
    ]);

    const members = membersRes.data ?? [];
    const snaps = snapsRes.data ?? [];

    // Group snapshots per member: pour chaque jour, on garde la dernière mesure 7j cumulée.
    const byMember = new Map<
      string,
      Array<{ day: number; messages7d: number; voice7d: number; ts: number }>
    >();
    for (const s of snaps) {
      const ts = new Date(s.taken_at).getTime();
      const day = Math.floor((now - ts) / DAY_MS); // 0 = aujourd'hui
      const arr = byMember.get(s.discord_id) ?? [];
      arr.push({
        day,
        messages7d: s.messages_7d ?? 0,
        voice7d: s.voice_7d_seconds ?? 0,
        ts,
      });
      byMember.set(s.discord_id, arr);
    }

    const rows: ChurnRow[] = members.map((m) => {
      const series = (byMember.get(m.discord_id) ?? []).sort(
        (a, b) => a.ts - b.ts,
      );

      // Moyenne 30j de référence (sur les snapshots les plus récents dans la fenêtre 0..30j)
      const ref30 = series.filter((p) => p.day <= 30);
      const avg30Messages =
        ref30.length > 0
          ? ref30.reduce((acc, p) => acc + p.messages7d, 0) / ref30.length
          : (m.messages_7d ?? 0);
      const avg30Voice =
        ref30.length > 0
          ? ref30.reduce((acc, p) => acc + p.voice7d, 0) / ref30.length
          : (m.voice_7d_seconds ?? 0);

      // Activité 7j actuelle
      const cur = (m.messages_7d ?? 0) + (m.voice_7d_seconds ?? 0) / 60;
      const ref = avg30Messages + avg30Voice / 60;
      const activity_drop = ref <= 0 ? 0 : Math.max(0, (ref - cur) / ref);

      // Pente sur 90j (présence = messages_7d normalisé)
      const trendPoints = series.map((p) => ({
        x: -p.day,
        y: p.messages7d + p.voice7d / 60,
      }));
      const presence_trend = slope(trendPoints);

      const tenure_days = m.arrival_date
        ? Math.floor((now - new Date(m.arrival_date).getTime()) / DAY_MS)
        : 0;

      const factors: ChurnRow["factors"] = {
        activity_drop,
        presence_trend,
        tenure_days,
        messages_7d: m.messages_7d ?? 0,
        voice_7d_seconds: m.voice_7d_seconds ?? 0,
      };

      return {
        discord_id: m.discord_id,
        ig_name: m.ig_name,
        discord_username: m.discord_username,
        avatar_url: m.avatar_url,
        factors,
        score: computeScore(factors),
      };
    });

    rows.sort((a, b) => b.score - a.score);

    return {
      rows: rows.slice(0, 30),
      computedAt: new Date(now).toISOString(),
      formula:
        "score = 50·activity_drop(7j vs 30j) + 30·max(0, -slope_90j·10) + 20·tenure_risk(<180j)",
    } satisfies ChurnPayload;
  },
);

// =========================================================
// Cohortes de rétention (par mois d'arrivée)
// =========================================================

export type CohortRow = {
  month: string; // YYYY-MM
  arrived: number;
  m1Rate: number; // 0..1
  m3Rate: number;
  m6Rate: number;
};

export type RetentionPayload = {
  cohorts: CohortRow[];
};

function ymKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

export const getRetentionCohorts = createServerFn({ method: "GET" }).handler(
  async () => {
    await requirePermission("members.view");

    const { data, error } = await db
      .from("members")
      .select("discord_id, arrival_date, status, updated_at")
      .not("arrival_date", "is", null)
      .limit(50_000);
    if (error) throw new Error(error.message);

    const now = Date.now();
    type Bucket = {
      arrived: number;
      stillM1: number;
      stillM3: number;
      stillM6: number;
      eligibleM1: number;
      eligibleM3: number;
      eligibleM6: number;
    };
    const map = new Map<string, Bucket>();

    for (const m of data ?? []) {
      if (!m.arrival_date) continue;
      const arrivedAt = new Date(m.arrival_date).getTime();
      const key = ymKey(new Date(arrivedAt));
      const b: Bucket =
        map.get(key) ??
        ({
          arrived: 0,
          stillM1: 0,
          stillM3: 0,
          stillM6: 0,
          eligibleM1: 0,
          eligibleM3: 0,
          eligibleM6: 0,
        } as Bucket);
      b.arrived += 1;

      const leftAt =
        m.status === "left" && m.updated_at
          ? new Date(m.updated_at).getTime()
          : null;

      const checkMonth = (months: number, stillKey: keyof Bucket, eligKey: keyof Bucket) => {
        const milestone = arrivedAt + months * 30 * DAY_MS;
        if (milestone > now) return; // pas encore éligible
        (b[eligKey] as number) += 1;
        const stillActive = leftAt === null || leftAt >= milestone;
        if (stillActive) (b[stillKey] as number) += 1;
      };

      checkMonth(1, "stillM1", "eligibleM1");
      checkMonth(3, "stillM3", "eligibleM3");
      checkMonth(6, "stillM6", "eligibleM6");

      map.set(key, b);
    }

    const cohorts: CohortRow[] = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, b]) => ({
        month,
        arrived: b.arrived,
        m1Rate: b.eligibleM1 > 0 ? b.stillM1 / b.eligibleM1 : -1,
        m3Rate: b.eligibleM3 > 0 ? b.stillM3 / b.eligibleM3 : -1,
        m6Rate: b.eligibleM6 > 0 ? b.stillM6 / b.eligibleM6 : -1,
      }));

    return { cohorts } satisfies RetentionPayload;
  },
);
