import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, Users, Eye, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RouteError } from "@/components/RouteError";
import { Guard } from "@/components/Guard";
import { PageHeader, PageCard, ErrorBlock } from "@/components/tools/ToolsUi";
import { getUsageStats } from "@/lib/data/usage.functions";

const PATH_LABELS: Record<string, string> = {
  "/dashboard": "Classement",
  "/polls": "Sondages",
  "/absences": "Absences",
  "/me": "Mon espace",
  "/welcome": "Bienvenue",
  "/assistant": "Assistant",
  "/tools": "Outils Paladium",
  "/tools/alerts": "Outil · Alertes",
  "/tools/player": "Outil · Player",
  "/tools/sales": "Outil · Ventes",
  "/tools/faction": "Outil · Faction",
  "/tools/check-bc": "Outil · Check BC",
  "/tools/status": "Outil · Status",
  "/tools/market": "Outil · Market",
  "/tools/leaderboard": "Outil · Leaderboard",
  "/tools/clicker": "Outil · Clicker",
  "/tools/xp-calculator": "Outil · XP Calc",
  "/tools/events": "Outil · Events",
  "/tools/uptime": "Outil · Uptime",
  "/tools/shop-admin": "Outil · Shop admin",
  "/staff": "Staff · Dashboard",
  "/staff-recap": "Staff · Récap",
  "/staff/announce": "Staff · Annonces",
  "/staff/appeals": "Staff · Appels",
  "/staff-analytics": "Staff · Analytics",
  "/members": "Membres",
  "/effectif": "Effectif",
  "/pdc": "Plan de coupe",
  "/recruitment": "Candidatures",
  "/blacklist": "Blacklist",
  "/points": "Gestion Points",
  "/config": "Config valeurs",
  "/logs": "Logs",
  "/admin": "Admin",
  "/projects": "Projets",
  "/logistics": "Logistique",
  "/faction-economy": "Économie faction",
  "/shop": "Shop",
  "/trials": "Trials",
  "/values": "Valeurs",
};

function prettyPath(p: string) {
  return PATH_LABELS[p] ?? p;
}

export const Route = createFileRoute("/_authenticated/staff-analytics")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Analytics site · Staff · PunkAstik" }] }),
  component: StaffAnalyticsPage,
});

const RANGES = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
] as const;

function StaffAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const fetchStats = useServerFn(getUsageStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-analytics", days],
    queryFn: () => fetchStats({ data: { days } }),
    refetchInterval: 60_000,
  });

  return (
    <Guard perm="members.view">
      <div className="space-y-5">
        <PageHeader
          code="// staff.analytics"
          title="Analytics site"
          description="Que font les membres sur le site — pages vues, outils utilisés, top utilisateurs."
        />

        <PageCard>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500" style={{ fontFamily: "'Space Mono'" }}>
              <BarChart3 className="size-4 text-pink-500" />
              Fenêtre d'analyse
            </div>
            <div className="inline-flex border border-zinc-800 bg-zinc-950">
              {RANGES.map((r) => {
                const active = days === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setDays(r.value)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] ${
                      active ? "bg-pink-500 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    }`}
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <ErrorBlock message={(error as Error).message} />}

          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard
              icon={Eye}
              label="Vues totales"
              value={isLoading ? "…" : (data?.totalViews ?? 0).toLocaleString("fr-FR")}
            />
            <StatCard
              icon={Users}
              label="Utilisateurs uniques"
              value={isLoading ? "…" : (data?.uniqueUsers ?? 0).toLocaleString("fr-FR")}
            />
            <StatCard
              icon={Activity}
              label="Vues / utilisateur"
              value={
                isLoading || !data || data.uniqueUsers === 0
                  ? "—"
                  : (data.totalViews / data.uniqueUsers).toFixed(1)
              }
            />
          </div>
        </PageCard>

        <PageCard>
          <h2
            className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-3"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // trafic quotidien
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={data?.daily ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-users" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#e4e4e7" }}
                  stroke="#52525b"
                  tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11, fill: "#e4e4e7" }} stroke="#52525b" allowDecimals={false} width={32} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#e4e4e7",
                  }}
                  labelStyle={{ color: "#fafafa" }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  name="Vues"
                  stroke="hsl(var(--primary))"
                  fill="url(#g-views)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Utilisateurs"
                  stroke="#facc15"
                  fill="url(#g-users)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PageCard>

        <div className="grid lg:grid-cols-2 gap-4">
          <PageCard>
            <h2
              className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-3"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // top pages
            </h2>
            <div className="space-y-1">
              {(data?.topPaths ?? []).map((p, i) => {
                const max = data?.topPaths[0]?.views ?? 1;
                const pct = Math.max(2, Math.round((p.views / max) * 100));
                return (
                  <div
                    key={p.path}
                    className="rounded-md border border-border/50 bg-card/40 px-3 py-2 hover:border-primary/40 transition"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{prettyPath(p.path)}</div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">{p.path}</div>
                      </div>
                      <div className="font-mono text-sm tabular-nums whitespace-nowrap">
                        <span className="text-white font-semibold">{p.views}</span>
                        <span className="text-zinc-500"> · {p.users} u.</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1 bg-zinc-900 overflow-hidden rounded-sm">
                      <div
                        className="h-full bg-pink-500/70"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="sr-only">#{i + 1}</span>
                  </div>
                );
              })}
              {!isLoading && (data?.topPaths.length ?? 0) === 0 && (
                <div className="text-xs text-zinc-500 py-8 text-center">
                  Pas encore de données — les pages vues seront enregistrées au fur et à mesure.
                </div>
              )}
            </div>
          </PageCard>

          <PageCard>
            <h2
              className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-3"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // top utilisateurs
            </h2>
            <div className="space-y-1">
              {(data?.topUsers ?? []).map((u, i) => (
                <div
                  key={u.discord_id}
                  className="flex items-center gap-3 rounded-md border border-border/50 bg-card/40 px-3 py-2"
                >
                  <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                    #{i + 1}
                  </span>
                  <Avatar className="size-8">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(u.ig_name ?? u.discord_username ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {u.ig_name ?? u.discord_username ?? u.discord_id}
                    </div>
                    {u.discord_username && u.ig_name && (
                      <div className="text-[10px] text-zinc-500 truncate font-mono">
                        @{u.discord_username}
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-sm font-semibold tabular-nums">{u.views}</div>
                </div>
              ))}
              {!isLoading && (data?.topUsers.length ?? 0) === 0 && (
                <div className="text-xs text-zinc-500 py-8 text-center">
                  Aucun utilisateur actif sur la période.
                </div>
              )}
            </div>
          </PageCard>
        </div>
      </div>
    </Guard>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div
        className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2"
        style={{ fontFamily: "'Space Mono'" }}
      >
        <Icon className="size-3.5 text-pink-500" />
        {label}
      </div>
      <div className="text-2xl font-bold text-white mt-1 tabular-nums" style={{ fontFamily: "'Space Grotesk'" }}>
        {value}
      </div>
    </div>
  );
}
