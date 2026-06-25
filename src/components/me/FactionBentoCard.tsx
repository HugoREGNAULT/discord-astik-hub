/**
 * Bento « La faction en chiffres » — richesse faction + évolution.
 * Lit depuis paladium_faction_wealth_history (snapshots cron).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, TrendingUp } from "lucide-react";
import { getFactionBento } from "@/lib/data/me.functions";
import { getFactionWealthHistory } from "@/lib/paladium/history.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonoLabel } from "@/components/tools/ToolsUi";

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtFull = (n: number) => n.toLocaleString("fr-FR");
const fmtMoney = (n: number) => `${fmtCompact(n)} $`;

export function FactionBentoCard() {
  const bentoFn = useServerFn(getFactionBento);
  const historyFn = useServerFn(getFactionWealthHistory);

  const { data } = useQuery({
    queryKey: ["me", "faction-bento"],
    queryFn: () => bentoFn(),
    refetchInterval: 60_000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["me", "faction-wealth-history"],
    queryFn: () => historyFn({ data: { days: 30 } }),
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
  });

  if (!data || !data.eligible) return null;

  const series = historyData?.rows ?? [];
  const maxWealth = Math.max(1, ...series.map((s) => s.total_wealth));

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
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Wallet className="size-3.5 text-primary" /> Richesse faction
          </div>
          <div
            className="text-3xl font-bold text-primary tabular-nums"
            title={`${fmtFull(data.totalWealth)} $`}
          >
            {fmtMoney(data.totalWealth)}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Vault: {fmtMoney(data.factionMoney)}</span>
            <span>Membres: {fmtMoney(data.membersMoney)}</span>
            <span>HDV en ligne: {fmtMoney(data.listedValue)}</span>
          </div>
          {data.lastSnapshotAt && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Mis à jour {formatRelative(data.lastSnapshotAt)}
            </div>
          )}
        </div>

        {series.length > 1 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="size-3 text-primary" /> Évolution de la richesse (30j)
            </div>
            <div className="flex h-16 items-end gap-px">
              {series.map((s, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/60 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(3, (s.total_wealth / maxWealth) * 100)}%` }}
                  title={`${new Date(s.captured_at).toLocaleDateString("fr-FR")} — ${fmtFull(s.total_wealth)} $`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR")}`;
}
