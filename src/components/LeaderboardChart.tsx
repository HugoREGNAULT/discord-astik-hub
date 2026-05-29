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

interface Props {
  snapshots: Snapshot[];
  topEntries: LeaderboardEntry[]; // already sorted top-3
  metric: LeaderboardMetric;
  period: "all" | "7d";
}

const COLORS = ["hsl(var(--primary))", "#facc15", "#f97316"];

function pickValue(s: Snapshot, metric: LeaderboardMetric, period: "all" | "7d") {
  if (metric === "points") return Number(s.astik_points);
  if (metric === "voice") return period === "7d" ? s.voice_7d_seconds : s.voice_total_seconds;
  return period === "7d" ? s.messages_7d : s.messages_total;
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
    const byTime = new Map<string, Record<string, number | string>>();
    for (const s of snapshots) {
      if (!allowed.has(s.discord_id)) continue;
      const bucket = new Date(s.taken_at).toISOString().slice(0, 13); // hour bucket
      let row = byTime.get(bucket);
      if (!row) {
        row = { t: bucket };
        byTime.set(bucket, row);
      }
      row[s.discord_id] = pickValue(s, metric, period);
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
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: string) => v.slice(5, 10).replace("-", "/") + " " + v.slice(11) + "h"}
            minTickGap={32}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => formatTick(Number(v), metric)}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
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
