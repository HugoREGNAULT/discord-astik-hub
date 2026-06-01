import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, UserX, CloudOff, Clock, BriefcaseBusiness } from "lucide-react";
import { getFactionJobs, type JobAnomaly } from "@/lib/data/faction-jobs.functions";
import { avatarUrl } from "@/lib/paladium/api";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({ meta: [{ title: "Suivi métiers · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <JobsPage />
    </Guard>
  ),
});

// Mapping/normalisation des noms de métiers Paladium → label FR
const JOB_LABELS: Record<string, string> = {
  miner: "Mineur",
  hunter: "Hunter",
  alchemist: "Alchimiste",
  alchemy: "Alchimiste",
  farmer: "Farmer",
  lumberjack: "Bûcheron",
  woodcutter: "Bûcheron",
  fisher: "Pêcheur",
  fishing: "Pêcheur",
};

const PRIORITY = ["miner", "hunter", "alchemist", "alchemy", "farmer"];

function labelOf(name: string) {
  return JOB_LABELS[name.toLowerCase()] ?? name;
}

function JobsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["faction-jobs"],
    queryFn: () => getFactionJobs(),
  });

  const jobNames = useMemo(() => {
    const names = data?.jobNames ?? [];
    const priority = PRIORITY.filter((p) => names.includes(p));
    const others = names.filter((n) => !PRIORITY.includes(n.toLowerCase()));
    return [...priority, ...others];
  }, [data?.jobNames]);

  const [selected, setSelected] = useState<string | null>(null);
  const currentJob = selected ?? jobNames[0] ?? null;

  const chartData = useMemo(() => {
    if (!data || !currentJob) return [];
    return data.members
      .map((m) => {
        const j = m.jobs.find((x) => x.name.toLowerCase() === currentJob.toLowerCase());
        return {
          name: m.ig_name || m.discord_username || m.discord_id.slice(0, 6),
          level: j?.level ?? 0,
          uuid: m.mc_uuid,
        };
      })
      .filter((r) => r.level > 0)
      .sort((a, b) => b.level - a.level);
  }, [data, currentJob]);

  const top = chartData[0];

  return (
    <div className="space-y-6">
      <PageHeader
        code="// faction"
        title="Suivi métiers"
        description="Classement temps réel des métiers Paladium pour tous les membres de la faction."
      />

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Membres actifs" value={data.stats.total_active} />
          <StatTile label="Comptes MC liés" value={data.stats.linked} />
          <StatTile label="Avec snapshot" value={data.stats.with_snapshot} />
          <StatTile
            label="Dernier sync"
            value={
              data.stats.latest_snapshot_at
                ? new Date(data.stats.latest_snapshot_at).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "—"
            }
            tone={data.stats.latest_snapshot_at ? "default" : "warn"}
          />
        </div>
      )}

      {data && data.anomalies.length > 0 && <AnomaliesCard anomalies={data.anomalies} />}

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Chargement…</CardContent>
        </Card>
      )}

      {!isLoading && data && data.members.length === 0 && (
        <Card>
          <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4" />
            Aucun membre n'a encore lié son compte Minecraft.
          </CardContent>
        </Card>
      )}

      {!isLoading && data && jobNames.length > 0 && currentJob && (
        <>
          <Tabs value={currentJob} onValueChange={setSelected}>
            <TabsList className="flex-wrap h-auto">
              {jobNames.map((j) => (
                <TabsTrigger key={j} value={j} className="capitalize">
                  {labelOf(j)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Classement {labelOf(currentJob)}{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  · {chartData.length} membre{chartData.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
              {top && (
                <Badge variant="secondary" className="gap-1">
                  🏆 {top.name} · Niv {top.level}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Aucun membre n'a de niveau dans ce métier.
                </div>
              ) : (
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`Niveau ${v}`, labelOf(currentJob)]}
                      />
                      <Bar dataKey="level" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? "#ec4899" : i < 3 ? "#5865F2" : "hsl(var(--primary))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail par membre</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {chartData.map((r, i) => (
                  <div
                    key={r.uuid}
                    className="flex items-center gap-3 p-3 rounded-md border bg-card"
                  >
                    <div className="text-xs font-mono text-muted-foreground w-6 text-right">
                      #{i + 1}
                    </div>
                    <img
                      src={avatarUrl(r.uuid, 32)}
                      alt=""
                      className="size-8 rounded border border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Niveau {r.level}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
