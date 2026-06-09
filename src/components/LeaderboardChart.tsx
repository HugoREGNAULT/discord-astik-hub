import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { LeaderboardEntry, LeaderboardMetric } from "@/lib/data/leaderboard.functions";

interface Snapshot {
  taken_at: string;
  discord_id: string;
  astik_points: number;
  voice_total_seconds: number;
  voice_7d_seconds: number;
  messages_total: number;
  messages_7d: number;
}

type Period = "all" | "24h" | "7d" | "30d";

interface Props {
  snapshots: Snapshot[];
  topEntries: LeaderboardEntry[]; // already sorted top-3
  metric: LeaderboardMetric;
  period: Period;
  /** Baseline calculée côté parent (même logique que les cartes top3). */
  baseline: Map<string, number> | null;
}

// hsl(var(--primary)) ne fonctionne pas dans un SVG Recharts (hors DOM) -> hex explicite
const COLORS = [
  "#ec4899", // pink-500 = primary
  "#facc15", // yellow
  "#f97316", // orange
  "#4ade80", // green
  "#60a5fa", // blue
  "#c084fc", // purple
  "#fb7185", // rose
  "#34d399", // emerald
  "#fbbf24", // amber
  "#a78bfa", // violet
];
const PERIOD_HOURS: Record<Exclude<Period, "all">, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

function pickTotal(s: Snapshot, metric: LeaderboardMetric) {
  if (metric === "points") return Number(s.astik_points);
  if (metric === "voice") return s.voice_total_seconds;
  return s.messages_total;
}

function formatTick(value: number, metric: LeaderboardMetric) {
  if (metric === "voice") {
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h${m}` : `${h}h`;
    return `${m}m`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function LeaderboardChart({ snapshots, topEntries, metric, period, baseline }: Props) {
  const top10 = topEntries.slice(0, 10);

  const data = useMemo(() => {
    if (top10.length === 0) return [];
    const allowed = new Set(top10.map((e) => e.discord_id));
    // Snapshot synthétique "now" depuis les totaux live pour refléter
    // les dernières mises à jour sans attendre le snapshot horaire suivant.
    const nowIso = new Date().toISOString();
    const liveSnapshots: Snapshot[] = top10.map((e) => ({
      taken_at: nowIso,
      discord_id: e.discord_id,
      astik_points: Number(e.astik_points ?? 0),
      voice_total_seconds: Number(e.voice_total_seconds ?? 0),
      voice_7d_seconds: Number(e.voice_7d_seconds ?? 0),
      messages_total: Number(e.messages_total ?? 0),
      messages_7d: Number(e.messages_7d ?? 0),
    }));
    const allSnapshots: Snapshot[] = [...snapshots, ...liveSnapshots];
    const cutoff = period === "all" ? 0 : Date.now() - PERIOD_HOURS[period] * 3600 * 1000;

    const byTime = new Map<string, Record<string, number | string>>();

    // Injecter un point de départ pour garantir ≥2 points même sans historique.
    // - Périodes bornées (24h/7j/30j) : point à 0 au cutoff (début de fenêtre).
    // - "all" : point avec les valeurs actuelles il y a 1h (évite data.length=1
    //   quand tous les snapshots tombent dans le même bucket horaire "now").
    if (period !== "all" && baseline != null) {
      const startBucket = new Date(cutoff).toISOString().slice(0, 16);
      const startRow: Record<string, number | string> = { t: startBucket };
      for (const e of top10) {
        if (baseline.has(e.discord_id)) startRow[e.discord_id] = 0;
      }
      byTime.set(startBucket, startRow);
    } else if (period === "all") {
      // Pour "all", si on n'a qu'un seul bucket (snapshots récents tous à "now"),
      // on ajoute un point 1h avant avec les valeurs actuelles comme ancre visuelle.
      const prevBucket = new Date(Date.now() - 3600 * 1000).toISOString().slice(0, 16);
      if (!byTime.has(prevBucket)) {
        const anchorRow: Record<string, number | string> = { t: prevBucket };
        for (const e of top10)
          anchorRow[e.discord_id] = pickTotal(
            {
              astik_points: Number(e.astik_points ?? 0),
              voice_total_seconds: Number(e.voice_total_seconds ?? 0),
              voice_7d_seconds: Number(e.voice_7d_seconds ?? 0),
              messages_total: Number(e.messages_total ?? 0),
              messages_7d: Number(e.messages_7d ?? 0),
            } as Snapshot,
            metric,
          );
        byTime.set(prevBucket, anchorRow);
      }
    }

    for (const s of allSnapshots) {
      if (!allowed.has(s.discord_id)) continue;
      const t = new Date(s.taken_at).getTime();
      if (t < cutoff) continue;
      const bucket = new Date(s.taken_at).toISOString().slice(0, 16); // minute bucket
      let row = byTime.get(bucket);
      if (!row) {
        row = { t: bucket };
        byTime.set(bucket, row);
      }
      const total = pickTotal(s, metric);
      if (period === "all" || !baseline) {
        row[s.discord_id] = total;
      } else {
        const base = baseline.get(s.discord_id);
        // Pas de baseline pour ce membre → on ne trace pas (évite ligne plate à 0).
        if (base != null) row[s.discord_id] = Math.max(0, total - base);
      }
    }
    return Array.from(byTime.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [snapshots, top10, metric, period, baseline]);

  if (data.length < 2) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
        Pas encore assez d'historique — un snapshot est capturé toutes les 5 minutes.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 11, fill: "#e4e4e7" }}
            stroke="#52525b"
            tickFormatter={(v: string) => v.slice(5, 10).replace("-", "/") + " " + v.slice(11, 16)}
            minTickGap={32}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#e4e4e7" }}
            stroke="#52525b"
            tickFormatter={(v) => formatTick(Number(v), metric)}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 6,
              fontSize: 12,
              color: "#e4e4e7",
            }}
            labelStyle={{ color: "#fafafa" }}
            formatter={(v: number, name: string) => [formatTick(v, metric), name]}
            labelFormatter={(l: string) => l.replace("T", " ")}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {top10.map((e, i) => (
            <Line
              key={e.discord_id}
              type="monotone"
              dataKey={e.discord_id}
              name={e.ig_name ?? e.discord_username ?? e.discord_id}
              stroke={COLORS[i]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
