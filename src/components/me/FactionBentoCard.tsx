/**
 * Bento « La faction en chiffres » — agrégats faction visibles par tout membre
 * faction (getFactionBento) : effectif, candidatures, richesse totale (argent en
 * jeu + ventes en cours), ventes réalisées sur 30 j (mini-graphe) et AstikPoints.
 * Lecture seule. Masqué si le membre n'est pas un vrai membre faction.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, FileText, Wallet, TrendingUp, Coins, UserPlus } from "lucide-react";
import { getFactionBento } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonoLabel } from "@/components/tools/ToolsUi";

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtFull = (n: number) => n.toLocaleString("fr-FR");
const fmtMoney = (n: number) => `${fmtCompact(n)} $`;

export function FactionBentoCard() {
  const fn = useServerFn(getFactionBento);
  const { data } = useQuery({
    queryKey: ["me", "faction-bento"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (!data || !data.eligible) return null;

  const series = data.sales.series;
  const maxSale = Math.max(1, ...series.map((s) => s.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> La faction en chiffres
          </span>
          <MonoLabel>// 30 derniers jours</MonoLabel>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Richesse totale — tuile large mise en avant */}
          <Tile
            className="col-span-2 bg-primary/5 border-primary/30"
            icon={Wallet}
            label="Richesse faction"
            value={fmtMoney(data.totalWealth)}
            sub="argent en jeu + ventes en ligne"
            big
            title={`${fmtFull(data.totalWealth)} $`}
          />

          <Tile
            icon={Users}
            label="Effectif"
            value={fmtFull(data.memberCount)}
            sub={data.arrivals30d > 0 ? `+${data.arrivals30d} ce mois` : "stable ce mois"}
          />

          <Tile
            icon={FileText}
            label="Candidatures"
            value={fmtFull(data.pendingApplications)}
            sub={`en attente · ${data.applications30d} sur 30 j`}
          />

          {/* Ventes réalisées + mini-graphe — tuile large */}
          <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-primary" /> Ventes HDV réalisées
              </div>
              <span className="text-xs text-muted-foreground">
                {fmtMoney(data.sales.listedValue)} en ligne
              </span>
            </div>
            <div
              className="mt-1 text-lg font-bold tabular-nums"
              title={`${fmtFull(data.sales.soldValue)} $`}
            >
              {fmtMoney(data.sales.soldValue)}
            </div>
            <div className="mt-2 flex h-12 items-end gap-px">
              {series.map((s) => (
                <div
                  key={s.day}
                  className="flex-1 rounded-sm bg-primary/60 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(3, (s.value / maxSale) * 100)}%` }}
                  title={`${new Date(s.day).toLocaleDateString("fr-FR")} — ${fmtFull(s.value)} $`}
                />
              ))}
            </div>
          </div>

          <Tile
            icon={Coins}
            label="AstikPoints cumulés"
            value={fmtCompact(data.totalAstikPoints)}
            sub="toute la faction"
            title={fmtFull(data.totalAstikPoints)}
          />

          <Tile
            icon={UserPlus}
            label="Arrivées"
            value={fmtFull(data.arrivals30d)}
            sub="nouveaux membres / 30 j"
          />
        </div>

        {data.moneyTracked < data.memberCount && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Argent en jeu connu pour {data.moneyTracked}/{data.memberCount} membres (lié à un compte
            MC suivi).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  className = "",
  big = false,
  title,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
  big?: boolean;
  title?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-muted/30 px-3 py-2.5 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </div>
      <div
        className={`mt-0.5 font-bold tabular-nums ${big ? "text-2xl text-primary" : "text-xl"}`}
        title={title}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
