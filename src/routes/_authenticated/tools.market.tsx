import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
const MarketHistoryChart = lazy(() => import("./-tools.market.chart"));
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { useServerFn } from "@tanstack/react-start";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, hasPaladiumKey, type MarketItemsPage } from "@/lib/paladium/api";
import { resolveUuidsToNames } from "@/lib/paladium/mojang.functions";
import { getMarketPriceHistory, getAdminShopHistory } from "@/lib/paladium/history.functions";
import { createShopAlert } from "@/lib/data/shop-alerts.functions";

export const Route = createFileRoute("/_authenticated/tools/market")({
  head: () => ({
    meta: [
      { title: "Market HDV · Outils PunkAstik" },
      { name: "description", content: "Liste des items en vente sur le HDV Paladium." },
    ],
  }),
  component: MarketPage,
});

type Row = MarketItemsPage["data"][number];

function MarketPage() {
  const q = useQuery({
    queryKey: ["pala-market-all"],
    queryFn: async () => {
      // Paginate through all items (max limit = 100).
      const first = await PaladiumApi.getMarketItemsPage(0, 100);
      const total = first.totalCount ?? first.data.length;
      const pages = Math.ceil(total / 100);
      const all: Row[] = [...first.data];
      const reqs: Promise<MarketItemsPage>[] = [];
      for (let i = 1; i < pages; i++) {
        reqs.push(PaladiumApi.getMarketItemsPage(i * 100, 100));
      }
      const rest = await Promise.all(reqs);
      for (const p of rest) all.push(...p.data);
      return all;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const [search, setSearch] = useState("");
  const [onlyWithListings, setOnlyWithListings] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo(() => {
    const term = search.toLowerCase().trim();
    const all = q.data ?? [];
    return all
      .filter((it) => !onlyWithListings || (it.countListings ?? 0) > 0)
      .filter((it) => !term || (it.name ?? "").toLowerCase().includes(term))
      .sort((a, b) => (b.quantityAvailable ?? 0) - (a.quantityAvailable ?? 0))
      .slice(0, 200);
  }, [q.data, search, onlyWithListings]);

  return (
    <div className="max-w-6xl space-y-5">
      <ToolHeader
        code="// tools.market"
        title="Market HDV"
        description="Recherche libre dans les ~1500 items du HDV. Clique sur une ligne pour voir les listings actifs."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un item (paladium-ore, endium…)"
            className="flex-1 bg-background border border-border px-3 py-2 text-sm text-white placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 font-mono"
          />
          <label
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground px-3"
            style={{ fontFamily: "'Space Mono'" }}
          >
            <input
              type="checkbox"
              checked={onlyWithListings}
              onChange={(e) => setOnlyWithListings(e.target.checked)}
              className="accent-primary"
            />
            En vente uniquement
          </label>
        </div>
      </ToolCard>

      {q.isLoading && <LoadingBlock label="Chargement du catalogue HDV…" />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      <div aria-live="polite" aria-busy={q.isLoading}>
        <p className="sr-only" aria-live="polite">
          {q.isLoading ? "Chargement du catalogue…" : `${items.length} item(s)`}
        </p>
      </div>
      {items.length > 0 && (
        <ToolCard className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                <th className="py-2 px-4">Item</th>
                <th className="py-2 px-4 text-right">Listings</th>
                <th className="py-2 px-4 text-right">Dispo</th>
                <th className="py-2 px-4 text-right">Prix moyen</th>
                <th className="py-2 px-4 text-right">Vendus</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <ItemRow
                  key={it.name}
                  it={it}
                  expanded={expanded === it.name}
                  onToggle={() => setExpanded((x) => (x === it.name ? null : it.name))}
                />
              ))}
            </tbody>
          </table>
        </ToolCard>
      )}
      {q.data && items.length === 0 && (
        <p className="text-muted-foreground/70 text-xs uppercase tracking-[0.3em] text-center py-6">
          aucun résultat
        </p>
      )}
    </div>
  );
}

function ItemRow({ it, expanded, onToggle }: { it: Row; expanded: boolean; onToggle: () => void }) {
  const detail = useQuery({
    queryKey: ["pala-market-item", it.name],
    queryFn: () => PaladiumApi.getMarketItem(it.name),
    enabled: expanded,
    retry: false,
    staleTime: 60_000,
  });

  const fetchHistory = useServerFn(getMarketPriceHistory);
  const fetchAdminHistory = useServerFn(getAdminShopHistory);
  const fetchNames = useServerFn(resolveUuidsToNames);
  const [range, setRange] = useState<"1h" | "24h" | "7d">("24h");
  const rangeHours = range === "1h" ? 1 : range === "24h" ? 24 : 168;
  const history = useQuery({
    queryKey: ["pala-market-history", it.name, range],
    queryFn: () => fetchHistory({ data: { itemName: it.name, rangeHours } }),
    enabled: expanded,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: false,
  });
  const adminHistory = useQuery({
    queryKey: ["pala-admin-history-for-market", it.name],
    queryFn: () => fetchAdminHistory({ data: { itemName: it.name } }),
    enabled: expanded,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: false,
  });

  // Merge market avg + admin buy/sell on a shared timeline, restricted to the
  // selected range. Each point: { t, marketAvg, adminBuy, adminSell }.
  const historySeries = useMemo(() => {
    const sinceMs = Date.now() - rangeHours * 3600_000;
    const byT = new Map<
      number,
      { t: number; marketAvg: number | null; adminBuy: number | null; adminSell: number | null }
    >();
    const ensure = (t: number) => {
      let row = byT.get(t);
      if (!row) {
        row = { t, marketAvg: null, adminBuy: null, adminSell: null };
        byT.set(t, row);
      }
      return row;
    };
    for (const r of history.data?.rows ?? []) {
      const t = new Date(r.captured_at).getTime();
      if (t < sinceMs) continue;
      ensure(t).marketAvg = r.price_average == null ? null : Number(r.price_average);
    }
    for (const r of adminHistory.data?.rows ?? []) {
      const t = new Date(r.captured_at).getTime();
      if (t < sinceMs) continue;
      const row = ensure(t);
      row.adminBuy = r.price == null ? null : Number(r.price);
      row.adminSell = r.price_pb == null ? null : Number(r.price_pb);
    }
    return Array.from(byT.values()).sort((a, b) => a.t - b.t);
  }, [history.data, adminHistory.data, rangeHours]);

  // Latest known values for the stat tiles.
  const latest = useMemo(() => {
    const lastMarket = [...(history.data?.rows ?? [])]
      .reverse()
      .find((r) => r.price_average != null);
    const lastAdmin = [...(adminHistory.data?.rows ?? [])]
      .reverse()
      .find((r) => r.price != null || r.price_pb != null);
    return {
      marketAvg: lastMarket?.price_average == null ? null : Number(lastMarket.price_average),
      adminBuy: lastAdmin?.price == null ? null : Number(lastAdmin.price),
      adminSell: lastAdmin?.price_pb == null ? null : Number(lastAdmin.price_pb),
    };
  }, [history.data, adminHistory.data]);

  // Resolve seller UUIDs → MC pseudos via Mojang (batched).
  const sellerUuids = useMemo(() => {
    const set = new Set<string>();
    for (const l of detail.data?.listing ?? []) {
      const candidate = l.seller ?? l.sellerName;
      if (typeof candidate === "string" && /^[0-9a-f-]{32,36}$/i.test(candidate)) {
        set.add(candidate);
      }
    }
    return Array.from(set);
  }, [detail.data]);

  const namesQ = useQuery({
    queryKey: ["mojang-names", ...sellerUuids],
    queryFn: () => fetchNames({ data: { uuids: sellerUuids } }),
    enabled: sellerUuids.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const nameMap = namesQ.data ?? {};

  function sellerLabel(l: { seller?: string; sellerName?: string }): string {
    const raw = l.sellerName ?? l.seller;
    if (!raw) return "—";
    if (/^[0-9a-f-]{32,36}$/i.test(raw)) {
      return nameMap[raw] ?? `${raw.slice(0, 8)}…`;
    }
    return raw;
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer"
      >
        <td className="py-2 px-4 text-foreground font-mono">{it.name}</td>
        <td className="py-2 px-4 text-right text-foreground/80">{it.countListings ?? 0}</td>
        <td className="py-2 px-4 text-right text-foreground/80">{fmtNum(it.quantityAvailable)}</td>
        <td className="py-2 px-4 text-right text-primary font-bold">{fmtNum(it.priceAverage)}</td>
        <td className="py-2 px-4 text-right text-muted-foreground">
          {fmtNum(it.quantitySoldTotal)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-background/60">
          <td colSpan={5} className="p-4">
            {detail.isLoading && <LoadingBlock label="Listings…" />}
            {detail.error && <ErrorBlock message={(detail.error as Error).message} />}

            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div
                className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // évolution achat / vente —{" "}
                {range === "1h" ? "1 heure" : range === "24h" ? "24 heures" : "7 jours"}
                <span className="text-muted-foreground/40 normal-case tracking-normal ml-2">
                  (auto 10 min)
                </span>
              </div>
              <div className="flex gap-1">
                {(["1h", "24h", "7d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] border ${
                      range === r
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground/80"
                    }`}
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <PriceTile label="HDV prix moyen u." value={latest.marketAvg} color="text-primary" />
              <PriceTile label="Shop achat u." value={latest.adminBuy} color="text-emerald-400" />
              <PriceTile label="Shop vente u. (PB)" value={latest.adminSell} color="text-sky-400" />
            </div>

            {historySeries.length < 2 ? (
              <p className="text-muted-foreground/70 text-xs mb-3">
                Pas encore assez d&apos;historique sur cette plage — la sync tourne toutes les
                heures.
              </p>
            ) : (
              <Suspense fallback={<div className="h-48 mb-4 animate-pulse rounded-md bg-muted" />}>
                <MarketHistoryChart data={historySeries} range={range} />
              </Suspense>
            )}

            <MarketAlertForm itemName={it.name} />

            {detail.data && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="py-1">Vendeur</th>
                    <th className="py-1 text-right">Qté</th>
                    <th className="py-1 text-right">Prix u.</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.data.listing ?? [])
                    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
                    .map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1 text-muted-foreground">{sellerLabel(l)}</td>
                        <td className="py-1 text-right text-foreground/80">{fmtNum(l.quantity)}</td>
                        <td className="py-1 text-right text-primary font-bold">
                          {fmtNum(l.price)}
                        </td>
                        <td className="py-1 text-right text-white">
                          {fmtNum((l.price ?? 0) * (l.quantity ?? 0))}
                        </td>
                      </tr>
                    ))}
                  {(detail.data.listing ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-muted-foreground/70">
                        aucun listing actif
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function fmtNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR");
}

function PriceTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div className="border border-border bg-secondary/60 p-2">
      <div
        className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mb-0.5"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {label}
      </div>
      <div className={`text-sm font-bold ${color}`} style={{ fontFamily: "'Space Grotesk'" }}>
        {fmtNum(value)}
      </div>
    </div>
  );
}

function MarketAlertForm({ itemName }: { itemName: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createShopAlert);
  const [direction, setDirection] = useState<"above" | "below">("below");
  const [threshold, setThreshold] = useState("");
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: (vars: { direction: "above" | "below"; threshold: number }) =>
      createFn({
        data: {
          source: "market" as const,
          item_name: itemName,
          price_type: "avg" as const,
          direction: vars.direction,
          threshold: vars.threshold,
        },
      }),
    onSuccess: () => {
      toast.success("Alerte HDV créée");
      setThreshold("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-shop-alerts"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(threshold);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Seuil invalide");
      return;
    }
    mut.mutate({ direction, threshold: n });
  };

  if (!open) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border border-border hover:text-primary hover:border-primary/40"
          style={{ fontFamily: "'Space Mono'" }}
        >
          <Bell className="size-3" /> créer une alerte HDV
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-3 border border-border rounded p-3 space-y-2 bg-background/60"
    >
      <div
        className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"
        style={{ fontFamily: "'Space Mono'" }}
      >
        <Bell className="size-3" /> // alerte sur prix moyen HDV
      </div>
      <div className="flex flex-wrap gap-2 text-xs items-center">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "above" | "below")}
          className="bg-secondary border border-border rounded px-2 py-1.5 text-foreground"
        >
          <option value="below">passe en dessous de</option>
          <option value="above">passe au-dessus de</option>
        </select>
        <input
          type="number"
          step="any"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="Seuil ($)"
          className="flex-1 min-w-[120px] bg-secondary border border-border rounded px-2 py-1.5 text-foreground"
        />
        <button
          type="submit"
          disabled={mut.isPending}
          className="px-3 py-1.5 bg-primary text-white text-xs uppercase tracking-wider rounded hover:bg-primary/90 disabled:opacity-50"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          {mut.isPending ? "…" : "Créer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-1.5 text-xs text-muted-foreground hover:text-white"
        >
          ✕
        </button>
      </div>
    </form>
  );
}
