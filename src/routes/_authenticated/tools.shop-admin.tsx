import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  SearchInput,
} from "@/components/tools/ToolsUi";
import { useServerFn } from "@tanstack/react-start";
import { getAdminShopLatest, getAdminShopHistory } from "@/lib/paladium/history.functions";

export const Route = createFileRoute("/_authenticated/tools/shop-admin")({
  head: () => ({
    meta: [
      { title: "Shop admin · Outils PunkAstik" },
      { name: "description", content: "Historique des prix du shop admin Paladium." },
    ],
  }),
  component: ShopAdminPage,
});

function ShopAdminPage() {
  const fetchLatest = useServerFn(getAdminShopLatest);
  const fetchHistory = useServerFn(getAdminShopHistory);
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const latest = useQuery({
    queryKey: ["admin-shop-latest"],
    queryFn: () => fetchLatest(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const items = latest.data?.items ?? [];

  const filtered = useMemo(() => {
    const needle = submitted.toLowerCase().trim();
    if (!needle) return items.slice(0, 100);
    return items
      .filter(
        (it) =>
          it.item_name.toLowerCase().includes(needle) ||
          (it.category ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 200);
  }, [items, submitted]);

  const history = useQuery({
    queryKey: ["admin-shop-history", selected],
    queryFn: () => fetchHistory({ data: { itemName: selected! } }),
    enabled: !!selected,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <div className="max-w-6xl space-y-5">
      <ToolHeader
        code="// tools.shop-admin"
        title="Shop admin"
        description="Prix actuels du shop admin Paladium et historique quotidien (snapshot 1×/jour)."
      />

      <ToolCard>
        <SearchInput
          value={q}
          onChange={setQ}
          onSubmit={() => setSubmitted(q)}
          placeholder="Filtrer par nom ou catégorie…"
        />
      </ToolCard>

      {latest.isLoading && <LoadingBlock />}
      {latest.error && <ErrorBlock message={(latest.error as Error).message} />}
      {!latest.isLoading && items.length === 0 && (
        <EmptyBlock label="Aucun snapshot — attends le prochain passage du cron (1×/jour)." />
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ToolCard className="!p-0 overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 px-4">Item</th>
                  <th className="py-2 px-4">Catégorie</th>
                  <th className="py-2 px-4 text-right">Prix</th>
                  <th className="py-2 px-4 text-right">PB</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr
                    key={it.item_name}
                    onClick={() => setSelected(it.item_name)}
                    className={`border-b border-zinc-900 cursor-pointer hover:bg-zinc-900/50 ${
                      selected === it.item_name ? "bg-pink-500/10" : ""
                    }`}
                  >
                    <td className="py-2 px-4 text-zinc-200 font-mono text-xs">{it.item_name}</td>
                    <td className="py-2 px-4 text-zinc-500 text-xs">{it.category ?? "—"}</td>
                    <td className="py-2 px-4 text-right text-white font-bold">
                      {it.price?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                    <td className="py-2 px-4 text-right text-pink-400 font-bold">
                      {it.price_pb?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ToolCard>

          <ToolCard>
            <div
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // historique {selected ?? "(clique un item)"}
            </div>
            {!selected && <EmptyBlock label="Sélectionne un item pour voir l'historique" />}
            {selected && history.isLoading && <LoadingBlock />}
            {selected && history.data && history.data.rows.length === 0 && (
              <EmptyBlock label="Pas encore d'historique pour cet item" />
            )}
            {selected && history.data && history.data.rows.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={history.data.rows.map((r) => ({
                      date: r.snapshot_date,
                      price: r.price,
                      pb: r.price_pb,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #3f3f46",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={false}
                      name="Prix"
                    />
                    <Line
                      type="monotone"
                      dataKey="pb"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={false}
                      name="PB"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ToolCard>
        </div>
      )}
    </div>
  );
}
