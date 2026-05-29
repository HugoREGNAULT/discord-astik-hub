import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface Point {
  date: string;
  created: number;
  accepted: number;
  rejected: number;
}

interface Props {
  data: Point[];
  range?: 30 | 90;
}

export function ApplicationsChart({ data, range = 90 }: Props) {
  const sliced = useMemo(() => data.slice(-range), [data, range]);
  const fmtDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sliced} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="g-created" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-accepted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-rejected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            minTickGap={30}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            width={28}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(l) => fmtDate(String(l))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="created"
            name="Reçues"
            stroke="hsl(var(--primary))"
            fill="url(#g-created)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="accepted"
            name="Acceptées"
            stroke="#22c55e"
            fill="url(#g-accepted)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="rejected"
            name="Refusées"
            stroke="#ef4444"
            fill="url(#g-rejected)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
