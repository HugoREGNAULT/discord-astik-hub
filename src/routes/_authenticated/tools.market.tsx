import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, asArray, hasPaladiumKey, type MarketItem } from "@/lib/paladium/api";

export const Route = createFileRoute("/_authenticated/tools/market")({
  head: () => ({
    meta: [
      { title: "Market HDV · Outils PunkAstik" },
      { name: "description", content: "Liste des items en vente sur le HDV Paladium." },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const q = useQuery({
    queryKey: ["pala-market"],
    queryFn: () => PaladiumApi.getMarketItems(),
    retry: false,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const items = useMemo(() => {
    const all = asArray<MarketItem>(q.data ?? null);
    const filtered = all.filter((it) => {
      const name = (it.name ?? it.item ?? it.id ?? "").toString().toLowerCase();
      return name.includes(search.toLowerCase().trim());
    });
    filtered.sort((a, b) => {
      const pa = Number(a.price ?? 0);
      const pb = Number(b.price ?? 0);
      return sortDir === "asc" ? pa - pb : pb - pa;
    });
    return filtered.slice(0, 300);
  }, [q.data, search, sortDir]);

  return (
    <div className="max-w-6xl space-y-5">
      <ToolHeader
        code="// tools.market"
        title="Market HDV"
        description="Items en vente sur l'hôtel des ventes Paladium."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un item…"
            className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-pink-500 focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-950 hover:border-pink-500 text-zinc-300 px-4 py-2 text-xs uppercase tracking-[0.2em]"
            style={{ fontFamily: "'Space Mono'" }}
          >
            Prix
            {sortDir === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </ToolCard>

      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      {items.length > 0 && (
        <ToolCard className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
                <th className="py-2 px-4">Item</th>
                <th className="py-2 px-4">Prix u.</th>
                <th className="py-2 px-4">Quantité</th>
                <th className="py-2 px-4">Vendeur</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/50">
                  <td className="py-2 px-4 text-zinc-200">
                    {it.name ?? it.item ?? it.id ?? "—"}
                  </td>
                  <td className="py-2 px-4 text-pink-400 font-bold">
                    {fmtNum(it.price)}
                  </td>
                  <td className="py-2 px-4 text-zinc-300">
                    {fmtNum(it.amount ?? it.quantity)}
                  </td>
                  <td className="py-2 px-4 text-zinc-400">
                    {it.sellerName ?? it.seller ?? "—"}
                  </td>
                </tr>
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

function fmtNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR");
}
