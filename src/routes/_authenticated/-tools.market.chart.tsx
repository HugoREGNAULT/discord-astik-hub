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

interface Point {
  t: number;
  marketAvg?: number | null;
  adminBuy?: number | null;
  adminSell?: number | null;
}

function fmtNum(n: unknown): string {
  return typeof n === "number" && Number.isFinite(n)
    ? new Intl.NumberFormat("fr-FR").format(n)
    : "—";
}

export default function MarketHistoryChart({
  data,
  range,
}: {
  data: Point[];
  range: "1h" | "24h" | "7d";
}) {
  return (
    <div className="h-48 mb-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(t) =>
              new Date(t).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                ...(range === "7d" ? {} : { hour: "2-digit", minute: "2-digit" }),
              })
            }
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 10 }}
          />
          <YAxis stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} width={60} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              fontSize: 12,
              color: "#e4e4e7",
            }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString("fr-FR")}
            formatter={(v: unknown) => fmtNum(v)}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          <Line
            type="monotone"
            dataKey="marketAvg"
            name="HDV moyen"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="adminBuy"
            name="Shop achat"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="adminSell"
            name="Shop vente"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
