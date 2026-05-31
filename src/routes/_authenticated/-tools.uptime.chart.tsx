import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Point {
  t: number;
  players: number;
  up?: 0 | 1 | number;
}

function formatTick(t: number, days: number): string {
  const d = new Date(t);
  if (days <= 1) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function UptimePlayersChart({ data, days }: { data: Point[]; days: number }) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="t"
            tickFormatter={(t) => formatTick(t, days)}
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 10 }}
          />
          <YAxis stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
            labelFormatter={(t) => new Date(t).toLocaleString("fr-FR")}
          />
          <Line type="monotone" dataKey="players" name="Joueurs" stroke="#ec4899" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UptimeStatusChart({ data, days }: { data: Point[]; days: number }) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="t"
            tickFormatter={(t) => formatTick(t, days)}
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 1]}
            tickFormatter={(v) => (v === 1 ? "UP" : "DOWN")}
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 10 }}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              fontSize: 12,
              color: "#e4e4e7",
            }}
            labelFormatter={(t) => new Date(t).toLocaleString("fr-FR")}
            formatter={(v: number) => (v === 1 ? "UP" : "DOWN")}
          />
          <Line type="stepAfter" dataKey="up" name="Statut" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default UptimePlayersChart;
