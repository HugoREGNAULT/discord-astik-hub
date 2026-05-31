import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Point {
  month: string;
  total: number;
  accepted: number;
  rejected: number;
}

export default function RecruitmentTimelineChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="month" stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 12 }} />
          <YAxis
            stroke="#52525b"
            tick={{ fill: "#e4e4e7", fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
              color: "#e4e4e7",
            }}
            labelStyle={{ color: "#fafafa" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#e4e4e7" }} />
          <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} />
          <Line type="monotone" dataKey="accepted" name="Acceptées" stroke="#10b981" strokeWidth={2} />
          <Line type="monotone" dataKey="rejected" name="Refusées" stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
