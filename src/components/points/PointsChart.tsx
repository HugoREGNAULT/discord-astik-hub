import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MemberTimeline, TimelinePoint } from "@/lib/data/points-timeline.functions";

// Palette violette pour les courbes de comparaison
const PALETTE = [
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#7c3aed",
  "#6d28d9",
  "#5b21b6",
  "#ddd6fe",
  "#ede9fe",
];

interface SingleChartProps {
  timeline: TimelinePoint[];
  label?: string;
}

/** Courbe simple — évolution d'un seul membre */
export function SinglePointsChart({ timeline, label }: SingleChartProps) {
  if (timeline.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-40 text-muted-foreground text-xs uppercase tracking-widest border-[3px] border-dashed border-border"
        style={{ fontFamily: "'Space Mono'" }}
      >
        Aucune donnée
      </div>
    );
  }

  const data = timeline.map((p) => ({
    date: new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    pts: p.cumulative,
    raw: p.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "Space Mono" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "Space Mono" }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "3px solid hsl(var(--border))",
            borderRadius: 0,
            fontFamily: "Space Mono",
            fontSize: 11,
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
          formatter={(v: number) => [`${v} pts`, label ?? "Points"]}
        />
        <Line
          type="monotone"
          dataKey="pts"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#8b5cf6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface ComparisonChartProps {
  timelines: MemberTimeline[];
  selected: string[];
}

/**
 * Courbes multiples — comparaison entre membres sélectionnés.
 * Toutes les timelines sont normalisées sur un axe de dates commun.
 */
export function ComparisonPointsChart({ timelines, selected }: ComparisonChartProps) {
  const visible = timelines.filter((t) => selected.includes(t.discord_id));

  if (visible.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-40 text-muted-foreground text-xs uppercase tracking-widest border-[3px] border-dashed border-border"
        style={{ fontFamily: "'Space Mono'" }}
      >
        Sélectionne au moins un membre
      </div>
    );
  }

  // Collecte toutes les dates uniques et trie
  const allDates = Array.from(
    new Set(visible.flatMap((t) => t.timeline.map((p) => p.date.slice(0, 10)))),
  ).sort();

  // Pour chaque date, on prend la dernière valeur cumulée connue de chaque membre
  const data = allDates.map((d) => {
    const row: Record<string, string | number> = { date: d.slice(5).replace("-", "/") };
    for (const t of visible) {
      const last = [...t.timeline].filter((p) => p.date.slice(0, 10) <= d).pop();
      row[t.discord_id] = last?.cumulative ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "Space Mono" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "Space Mono" }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "3px solid hsl(var(--border))",
            borderRadius: 0,
            fontFamily: "Space Mono",
            fontSize: 11,
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
          formatter={(v: number, name: string) => {
            const member = visible.find((t) => t.discord_id === name);
            return [`${v} pts`, member?.ig_name ?? name];
          }}
        />
        {visible.map((t, i) => (
          <Line
            key={t.discord_id}
            type="monotone"
            dataKey={t.discord_id}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name={t.discord_id}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
