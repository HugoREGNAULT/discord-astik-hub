import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Row {
  captured_at: string;
  price: number | null;
  price_pb: number | null;
}

export default function ShopAdminHistoryChart({ rows }: { rows: Row[] }) {
  const data = rows.map((r) => ({
    t: new Date(r.captured_at).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    buy: r.price,
    sell: r.price_pb,
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="t" stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} />
          <YAxis stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              fontSize: 12,
              color: "#e4e4e7",
            }}
          />
          <Line type="monotone" dataKey="sell" stroke="#ec4899" strokeWidth={2} dot={false} name="Vente" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
