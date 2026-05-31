import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { PageHeader, PageCard } from "@/components/tools/ToolsUi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { CardListSkeleton } from "@/components/Skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { getFactionSalesOverview } from "@/lib/data/faction-economy.functions";

export const Route = createFileRoute("/_authenticated/faction-economy")({
  head: () => ({ meta: [{ title: "Économie faction · PunkAstik" }] }),
  component: FactionEconomyPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

function FactionEconomyPage() {
  const { data: me } = useCurrentUser();
  const canAccess = hasPerm(me, "members.view");
  const fetchOverview = useServerFn(getFactionSalesOverview);
  const q = useQuery({
    queryKey: ["faction-economy"],
    queryFn: () => fetchOverview({ data: undefined as any }),
    enabled: canAccess,
  });

  const data = q.data;

  const maxSold = useMemo(() => {
    const rows: any[] = data?.rows ?? [];
    return rows.reduce((m, r) => Math.max(m, r.soldValue), 0) || 1;
  }, [data]);

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader code="staff/economy" title="Économie faction" description="Accès staff requis." />
        <EmptyState title="Accès refusé" description="Permission staff requise." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        code="staff/economy"
        title="Économie faction"
        description="Ventes HDV des membres sur les 30 derniers jours."
      />

      {q.isLoading ? (
        <CardListSkeleton count={3} />
      ) : !data ? (
        <EmptyState title="Aucune donnée" description="Pas encore de ventes trackées." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label="Valeur vendue (30j)" value={fmt(data.totals.soldValue)} suffix="$" />
            <StatCard
              label="Valeur listée actuelle"
              value={fmt(data.totals.listedValue)}
              suffix="$"
            />
            <StatCard label="Membres trackés" value={String(data.rows.length)} />
          </div>

          <PageCard>
            <div className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ventes dans le temps
              </h3>
              {data.series.length === 0 ? (
                <p className="text-xs text-muted-foreground">Pas encore de vente.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ecoGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="day"
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
                      <YAxis stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`${fmt(v)} $`, "Vendu"]}
                        labelFormatter={(d: string) =>
                          new Date(d).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                          })
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#ec4899"
                        fill="url(#ecoGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </PageCard>

          <PageCard>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Membres
                </h3>
                <Badge variant="secondary">{data.rows.length}</Badge>
              </div>
              {data.rows.length === 0 ? (
                <EmptyState
                  title="Aucun membre tracké"
                  description="Aucun membre actif n'a de pseudo Minecraft lié pour le moment."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membre</TableHead>
                      <TableHead className="text-right">En vente</TableHead>
                      <TableHead className="text-right">Vendus</TableHead>
                      <TableHead className="text-right">Listé</TableHead>
                      <TableHead className="text-right">Vendu</TableHead>
                      <TableHead className="w-[120px]">Part</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r: any) => (
                      <TableRow key={r.discord_id}>
                        <TableCell>
                          <Link
                            to="/members/$id"
                            params={{ id: r.discord_id }}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {r.openCount}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {r.soldCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(r.listedValue)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-pink-400">
                          {fmt(r.soldValue)}
                        </TableCell>
                        <TableCell>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-pink-500"
                              style={{ width: `${(r.soldValue / maxSold) * 100}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </PageCard>

          <PageCard>
            <div className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Top items vendus par la faction
              </h3>
              {data.topItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune vente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Valeur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topItems.map((it: any) => (
                      <TableRow key={it.item_name}>
                        <TableCell className="font-medium">{it.item_name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {it.count}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {fmt(it.qty)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-pink-400">
                          {fmt(it.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </PageCard>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">
          {value}
          {suffix ? <span className="ml-1 text-sm text-muted-foreground">{suffix}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
