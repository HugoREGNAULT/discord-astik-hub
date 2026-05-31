import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, Coins, AlertTriangle } from "lucide-react";
import { getPublicPoints } from "@/lib/data/public-points.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/values")({
  head: () => ({ meta: [{ title: "Valeurs & ressources · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <ValuesPage />
    </Guard>
  ),
});

const CAT_LABEL: Record<string, string> = {
  item: "Items",
  action: "Actions",
  money: "Argent",
  other: "Autres",
};

function ValuesPage() {
  const fn = useServerFn(getPublicPoints);
  const { data, isLoading } = useQuery({
    queryKey: ["public-points"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const values = data?.values ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q ? values.filter((v) => v.name.toLowerCase().includes(q)) : values;
    const map = new Map<string, typeof values>();
    for (const v of filtered) {
      const arr = map.get(v.category) ?? [];
      arr.push(v);
      map.set(v.category, arr);
    }
    return map;
  }, [data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        code="// points"
        title="Valeurs & ressources"
        subtitle="Tarifs des items/actions et ressources manquantes sur les projets en cours."
      />

      <Tabs defaultValue="values">
        <TabsList>
          <TabsTrigger value="values">
            <Coins className="mr-2 h-4 w-4" /> Valeurs des points
          </TabsTrigger>
          <TabsTrigger value="missing">
            <AlertTriangle className="mr-2 h-4 w-4" /> Ressources manquantes
            {data?.missingAggregated?.length ? (
              <Badge variant="secondary" className="ml-2">
                {data.missingAggregated.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="values" className="space-y-4">
          <Input
            placeholder="Rechercher un item ou une action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && (data?.values?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Aucune valeur configurée.</p>
          )}
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-base">{CAT_LABEL[cat] ?? cat}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((v) => {
                    const evo = data?.evolution?.[v.id];
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 rounded-md border border-border/50 bg-card/50 p-3"
                      >
                        {v.image_url ? (
                          <img
                            src={v.image_url}
                            alt=""
                            className="h-10 w-10 rounded object-contain"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{v.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {Number(v.points).toLocaleString("fr-FR", {
                              maximumFractionDigits: 3,
                            })}{" "}
                            pts
                          </div>
                        </div>
                        <EvolutionPill deltaPct={evo?.deltaPct ?? null} previous={evo?.previous} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="missing" className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && (data?.missingAggregated?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune ressource manquante. Tous les projets actifs sont approvisionnés.
            </p>
          )}
          {(data?.missingAggregated?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agrégé sur tous les projets actifs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {data!.missingAggregated.map((m) => (
                    <div
                      key={m.item_name}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{m.item_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {m.projects.join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-amber-500">
                          {Number(m.qty_missing).toLocaleString("fr-FR")} manquants
                        </div>
                        {m.unit_points > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {m.unit_points} pts / unité
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EvolutionPill({
  deltaPct,
  previous,
}: {
  deltaPct: number | null | undefined;
  previous: number | undefined;
}) {
  if (deltaPct === null || deltaPct === undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const abs = Math.abs(deltaPct);
  const up = deltaPct > 0.01;
  const down = deltaPct < -0.01;
  const flat = !up && !down;
  return (
    <span
      title={previous !== undefined ? `Réf. ${previous} pts` : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        up && "bg-emerald-500/15 text-emerald-500",
        down && "bg-rose-500/15 text-rose-500",
        flat && "bg-muted text-muted-foreground",
      )}
    >
      {up && <ArrowUp className="h-3 w-3" />}
      {down && <ArrowDown className="h-3 w-3" />}
      {flat && <Minus className="h-3 w-3" />}
      {flat ? "0 %" : `${up ? "+" : "-"}${abs.toFixed(1)} %`}
    </span>
  );
}
