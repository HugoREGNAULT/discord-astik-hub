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

// Nombre de ticks à afficher selon le range
function tickCount(days: number): number {
  if (days <= 1) return 8;
  if (days <= 7) return 7;
  return 10;
}

export function UptimePlayersChart({ data, days }: { data: Point[]; days: number }) {
  const now = Date.now();
  // S'assurer que le domaine couvre jusqu'à maintenant même si le dernier point est ancien
  const domainMax = data.length > 0 ? Math.max(data[data.length - 1].t, now) : now;
  const domainMin = data.length > 0 ? data[0].t : now - days * 86_400_000;

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[domainMin, domainMax]}
            tickCount={tickCount(days)}
            tickFormatter={(t) => formatTick(t as number, days)}
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 10 }}
          />
          <YAxis stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
            labelFormatter={(t) => new Date(t as number).toLocaleString("fr-FR")}
          />
          <Line
            type="monotone"
            dataKey="players"
            name="Joueurs"
            stroke="#ec4899"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UptimeStatusChart({ data, days }: { data: Point[]; days: number }) {
  const now = Date.now();
  const domainMax = data.length > 0 ? Math.max(data[data.length - 1].t, now) : now;
  const domainMin = data.length > 0 ? data[0].t : now - days * 86_400_000;

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[domainMin, domainMax]}
            tickCount={tickCount(days)}
            tickFormatter={(t) => formatTick(t as number, days)}
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
            labelFormatter={(t) => new Date(t as number).toLocaleString("fr-FR")}
            formatter={(v: number) => (v === 1 ? "UP" : "DOWN")}
          />
          <Line
            type="stepAfter"
            dataKey="up"
            name="Statut"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default UptimePlayersChart;
