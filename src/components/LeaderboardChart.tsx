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
}

const COLORS = ["hsl(var(--primary))", "#facc15", "#f97316"];
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
    return `${h}h`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function LeaderboardChart({ snapshots, topEntries, metric, period }: Props) {
  const top3 = topEntries.slice(0, 3);

  const data = useMemo(() => {
    if (top3.length === 0) return [];
    const allowed = new Set(top3.map((e) => e.discord_id));
    // Append a synthetic "now" snapshot from live totals so the chart reflects
    // the most recent updates without waiting for the next hourly capture.
    const nowIso = new Date().toISOString();
    const liveSnapshots: Snapshot[] = top3.map((e) => ({
      taken_at: nowIso,
      discord_id: e.discord_id,
      astik_points: Number(e.astik_points ?? 0),
      voice_total_seconds: Number(e.voice_total_seconds ?? 0),
      voice_7d_seconds: Number(e.voice_7d_seconds ?? 0),
      messages_total: Number(e.messages_total ?? 0),
      messages_7d: Number(e.messages_7d ?? 0),
    }));
    const allSnapshots: Snapshot[] = [...snapshots, ...liveSnapshots];
    // Filtre la fenêtre temporelle
    const cutoff = period === "all" ? 0 : Date.now() - PERIOD_HOURS[period] * 3600 * 1000;
    // Baseline par membre = dernière valeur connue <= cutoff
    const baseline = new Map<string, number>();
    if (period !== "all") {
      const best = new Map<string, { t: number; v: number }>();
      for (const s of allSnapshots) {
        if (!allowed.has(s.discord_id)) continue;
        const t = new Date(s.taken_at).getTime();
        if (t > cutoff) continue;
        const v = pickTotal(s, metric);
        const cur = best.get(s.discord_id);
        if (!cur || t > cur.t) best.set(s.discord_id, { t, v });
      }
      for (const [k, v] of best) baseline.set(k, v.v);
    }

    const byTime = new Map<string, Record<string, number | string>>();
    for (const s of snapshots) {
      if (!allowed.has(s.discord_id)) continue;
      const t = new Date(s.taken_at).getTime();
      if (t < cutoff) continue;
      const bucket = new Date(s.taken_at).toISOString().slice(0, 13); // hour bucket
      let row = byTime.get(bucket);
      if (!row) {
        row = { t: bucket };
        byTime.set(bucket, row);
      }
      const total = pickTotal(s, metric);
      row[s.discord_id] =
        period === "all" ? total : Math.max(0, total - (baseline.get(s.discord_id) ?? total));
    }
    return Array.from(byTime.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [snapshots, top3, metric, period]);

  if (data.length < 2) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
        Pas encore assez d'historique — un snapshot est capturé chaque heure.
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
            tickFormatter={(v: string) =>
              v.slice(5, 10).replace("-", "/") + " " + v.slice(11) + "h"
            }
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
            formatter={(v: number) => formatTick(v, metric)}
            labelFormatter={(l: string) => l.replace("T", " ") + "h"}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {top3.map((e, i) => (
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
