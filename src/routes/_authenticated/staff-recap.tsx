import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { RouteError } from "@/components/RouteError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Coins, ShoppingCart, UserMinus } from "lucide-react";
import { getStaffRecap, type StaffRecap } from "@/lib/data/staff-recap.functions";

export const Route = createFileRoute("/_authenticated/staff-recap")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Récap staff · PunkAstik" }] }),
  component: RecapPage,
});

function fmtInt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? (
    <img src={url} alt="" className="size-7 rounded-full shrink-0" />
  ) : (
    <div className="size-7 rounded-full bg-muted shrink-0 grid place-items-center text-[10px] text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function RecapPage() {
  return (
    <Guard perm="members.view">
      <PageHeader
        code="STAFF/RECAP"
        title="Récap staff"
        description="Vue d'ensemble : classement Punk, ventes membres, absents."
      />
      <RecapContent />
    </Guard>
  );
}

function RecapContent() {
  const fetcher = useServerFn(getStaffRecap);
  const { data, isLoading, error } = useQuery<StaffRecap>({
    queryKey: ["staff-recap"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Erreur"}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Évol classement Punk */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-primary" />
            Évol. classement Punk
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Top 8 · variation 7j · {fmtInt(data.punk.totalActive)} membres actifs
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {data.punk.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          ) : (
            data.punk.top.map((r, i) => (
              <Link
                key={r.discord_id}
                to="/members/$id"
                params={{ id: r.discord_id }}
                className="flex items-center gap-2 rounded p-2 hover:bg-muted/50 transition"
              >
                <span className="text-xs text-muted-foreground w-5 tabular-nums">
                  #{i + 1}
                </span>
                <Avatar url={r.avatar_url} name={r.name} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{r.name}</div>
                  {r.current_grade && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.current_grade}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono tabular-nums">{fmtInt(r.points)}</div>
                  <div
                    className={`text-[10px] flex items-center justify-end gap-0.5 tabular-nums ${
                      r.delta_7d > 0
                        ? "text-emerald-500"
                        : r.delta_7d < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {r.delta_7d > 0 ? (
                      <ArrowUpRight className="size-3" />
                    ) : r.delta_7d < 0 ? (
                      <ArrowDownRight className="size-3" />
                    ) : null}
                    {r.delta_7d > 0 ? "+" : ""}
                    {fmtInt(r.delta_7d)} 7j
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Volume ventes membres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-4 text-primary" />
            Ventes membres (7j)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {fmtInt(data.sales.totalValue7d)} $ · {data.sales.sellersCount} vendeurs
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {data.sales.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vente sur 7 jours.</p>
          ) : (
            data.sales.top.map((r, i) => (
              <Link
                key={r.discord_id}
                to="/members/$id"
                params={{ id: r.discord_id }}
                className="flex items-center gap-2 rounded p-2 hover:bg-muted/50 transition"
              >
                <span className="text-xs text-muted-foreground w-5 tabular-nums">
                  #{i + 1}
                </span>
                <Avatar url={r.avatar_url} name={r.name} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.sold_count} vente{r.sold_count > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-sm font-mono tabular-nums">{fmtInt(r.sold_value)} $</div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Absences en cours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserMinus className="size-4 text-primary" />
            Absents actuellement
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {fmtInt(data.absences.count)} membre{data.absences.count > 1 ? "s" : ""} en absence
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {data.absences.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Personne en absence.</p>
          ) : (
            data.absences.rows.map((r) => (
              <Link
                key={`${r.discord_id}-${r.starts_on}`}
                to="/members/$id"
                params={{ id: r.discord_id }}
                className="flex items-center gap-2 rounded p-2 hover:bg-muted/50 transition"
              >
                <Avatar url={r.avatar_url} name={r.name} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    jusqu'au {new Date(r.ends_on).toLocaleDateString("fr-FR")}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {r.type}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
