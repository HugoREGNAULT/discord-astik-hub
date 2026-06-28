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
  count: number;
  inactive?: number;
  absent?: number;
}

const SERIES_LABELS: Record<string, string> = {
  count: "Effectif",
  inactive: "Inactifs",
  absent: "Absents",
};

export default function StaffHealthChart({ evolution }: { evolution: Point[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={evolution} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="inactiveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 11 }}
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
              })
            }
            minTickGap={30}
          />
          <YAxis
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 11 }}
            width={32}
            allowDecimals={false}
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
            labelFormatter={(l: string) => new Date(l).toLocaleDateString("fr-FR")}
            formatter={(v: number, name: string) => [v, SERIES_LABELS[name] ?? name]}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: "#e4e4e7" }}
            formatter={(name: string) => SERIES_LABELS[name] ?? name}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#healthGrad)"
          />
          <Area
            type="monotone"
            dataKey="inactive"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#inactiveGrad)"
          />
          <Area
            type="monotone"
            dataKey="absent"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#absentGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
