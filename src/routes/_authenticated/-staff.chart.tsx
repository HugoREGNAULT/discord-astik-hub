import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Point {
  date: string;
  count: number;
}

export default function StaffHealthChart({ evolution }: { evolution: Point[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={evolution} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
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
            formatter={(v: number) => [`${v} membres`, "Effectif"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#ec4899"
            strokeWidth={2}
            fill="url(#healthGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
