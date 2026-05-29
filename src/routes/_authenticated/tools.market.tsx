import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, hasPaladiumKey, type MarketItemsPage } from "@/lib/paladium/api";

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
            className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-pink-500 focus:outline-none font-mono"
          />
          <label
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400 px-3"
            style={{ fontFamily: "'Space Mono'" }}
          >
            <input
              type="checkbox"
              checked={onlyWithListings}
              onChange={(e) => setOnlyWithListings(e.target.checked)}
              className="accent-pink-500"
            />
            En vente uniquement
          </label>
        </div>
      </ToolCard>

      {q.isLoading && <LoadingBlock label="Chargement du catalogue HDV…" />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      {items.length > 0 && (
        <ToolCard className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
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
        <p className="text-zinc-600 text-xs uppercase tracking-[0.3em] text-center py-6">
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
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/50 cursor-pointer"
      >
        <td className="py-2 px-4 text-zinc-200 font-mono">{it.name}</td>
        <td className="py-2 px-4 text-right text-zinc-300">{it.countListings ?? 0}</td>
        <td className="py-2 px-4 text-right text-zinc-300">{fmtNum(it.quantityAvailable)}</td>
        <td className="py-2 px-4 text-right text-pink-400 font-bold">{fmtNum(it.priceAverage)}</td>
        <td className="py-2 px-4 text-right text-zinc-500">{fmtNum(it.quantitySoldTotal)}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-zinc-900 bg-zinc-950/60">
          <td colSpan={5} className="p-4">
            {detail.isLoading && <LoadingBlock label="Listings…" />}
            {detail.error && <ErrorBlock message={(detail.error as Error).message} />}
            {detail.data && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500">
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
                      <tr key={i} className="border-t border-zinc-900">
                        <td className="py-1 text-zinc-400">{l.sellerName ?? l.seller ?? "—"}</td>
                        <td className="py-1 text-right text-zinc-300">{fmtNum(l.quantity)}</td>
                        <td className="py-1 text-right text-pink-400 font-bold">
                          {fmtNum(l.price)}
                        </td>
                        <td className="py-1 text-right text-white">
                          {fmtNum((l.price ?? 0) * (l.quantity ?? 0))}
                        </td>
                      </tr>
                    ))}
                  {(detail.data.listing ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-zinc-600">
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
