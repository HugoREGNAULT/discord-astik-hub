import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
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
import {
  getAdminShopLatest,
  getAdminShopHistory,
  getAdminShopTopMovers,
} from "@/lib/paladium/history.functions";
import {
  listMyShopAlerts,
  createShopAlert,
  deleteShopAlert,
} from "@/lib/data/shop-alerts.functions";

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
  const fetchMovers = useServerFn(getAdminShopTopMovers);
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const latest = useQuery({
    queryKey: ["admin-shop-latest"],
    queryFn: () => fetchLatest(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const movers = useQuery({
    queryKey: ["admin-shop-movers"],
    queryFn: () => fetchMovers(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const items = useMemo(() => latest.data?.items ?? [], [latest.data?.items]);

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
    <div className="max-w-7xl space-y-5">
      <ToolHeader
        code="// tools.shop-admin"
        title="Shop admin"
        description="Prix d'achat / vente du shop admin Paladium et évolution (snapshot toutes les 5 min, 30j)."
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
        <EmptyBlock label="Aucun snapshot — attends le prochain passage du cron (toutes les 5 min)." />
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ToolCard className="!p-0 overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 px-4">Item</th>
                  <th className="py-2 px-4">Catégorie</th>
                  <th className="py-2 px-4 text-right">Achat</th>
                  <th className="py-2 px-4 text-right">Vente</th>
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
                      t: new Date(r.captured_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      buy: r.price,
                      sell: r.price_pb,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="t" stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} />
                    <YAxis stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #3f3f46",
                        fontSize: 12,
                        color: "#e4e4e7",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sell"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={false}
                      name="Vente"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {selected && <AlertForm itemName={selected} />}
          </ToolCard>

          <ToolCard className="lg:col-span-2">
            <MyAlertsPanel />
          </ToolCard>

          <ToolCard className="lg:col-span-2">
            <div
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // top mouvements vente (7j)
            </div>
            {movers.isLoading && <LoadingBlock />}
            {movers.data && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <MoversList
                  title="Top hausses"
                  rows={movers.data.top}
                  positive
                  onPick={setSelected}
                />
                <MoversList
                  title="Top baisses"
                  rows={movers.data.flop}
                  positive={false}
                  onPick={setSelected}
                />
              </div>
            )}
          </ToolCard>
        </div>
      )}
    </div>
  );
}

function MoversList({
  title,
  rows,
  positive,
  onPick,
}: {
  title: string;
  rows: Array<{ item_name: string; current: number; pct: number }>;
  positive: boolean;
  onPick: (name: string) => void;
}) {
  const color = positive ? "text-emerald-400" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-400 mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-zinc-600">—</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.item_name}
              onClick={() => onPick(r.item_name)}
              className="cursor-pointer rounded border border-zinc-800 bg-zinc-900/40 p-3 hover:bg-zinc-900"
            >
              <div className="font-mono text-xs text-zinc-200 truncate">{r.item_name}</div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className={`text-2xl font-bold ${color}`}>
                  {sign}
                  {r.pct.toFixed(1)}%
                </span>
                <span className="text-sm text-pink-400 font-bold">
                  {r.current.toLocaleString("fr-FR")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertForm({ itemName }: { itemName: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createShopAlert);
  const [priceType, setPriceType] = useState<"buy" | "sell">("sell");
  const [direction, setDirection] = useState<"above" | "below">("below");
  const [threshold, setThreshold] = useState("");

  const mut = useMutation({
    mutationFn: (vars: {
      item_name: string;
      price_type: "buy" | "sell";
      direction: "above" | "below";
      threshold: number;
    }) => createFn({ data: { ...vars, source: "shop_admin" as const } }),
    onSuccess: () => {
      toast.success("Alerte créée");
      setThreshold("");
      qc.invalidateQueries({ queryKey: ["my-shop-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(threshold);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Seuil invalide");
      return;
    }
    mut.mutate({ item_name: itemName, price_type: priceType, direction, threshold: n });
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-zinc-800 pt-4 space-y-3">
      <div
        className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2"
        style={{ fontFamily: "'Space Mono'" }}
      >
        <Bell className="size-3" /> // créer une alerte
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <select
          value={priceType}
          onChange={(e) => setPriceType(e.target.value as "buy" | "sell")}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200"
        >
          <option value="sell">Prix vente</option>
          <option value="buy">Prix achat</option>
        </select>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "above" | "below")}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200"
        >
          <option value="below">passe en dessous de</option>
          <option value="above">passe au-dessus de</option>
        </select>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="Seuil ($)"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200"
        />
        <button
          type="submit"
          disabled={mut.isPending}
          className="px-3 py-1.5 bg-pink-500 text-white text-xs uppercase tracking-wider rounded hover:bg-pink-600 disabled:opacity-50"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          {mut.isPending ? "…" : "Créer"}
        </button>
      </div>
    </form>
  );
}

function MyAlertsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyShopAlerts);
  const deleteFn = useServerFn(deleteShopAlert);
  const q = useQuery({
    queryKey: ["my-shop-alerts"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Alerte supprimée");
      qc.invalidateQueries({ queryKey: ["my-shop-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3 flex items-center gap-2"
        style={{ fontFamily: "'Space Mono'" }}
      >
        <Bell className="size-3" /> // mes alertes prix
      </div>
      {q.isLoading && <LoadingBlock />}
      {q.data && q.data.alerts.length === 0 && (
        <EmptyBlock label="Aucune alerte. Sélectionne un item et crée-en une." />
      )}
      {q.data && q.data.alerts.length > 0 && (
        <ul className="space-y-2">
          {q.data.alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-zinc-200 truncate">{a.item_name}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                  {a.price_type === "sell" ? "vente" : "achat"} ·{" "}
                  {a.direction === "below" ? "≤" : "≥"} {a.threshold.toLocaleString("fr-FR")}
                  {a.is_triggered && <span className="ml-2 text-amber-400">· déclenchée</span>}
                </div>
              </div>
              <button
                onClick={() => del.mutate(a.id)}
                disabled={del.isPending}
                className="text-zinc-500 hover:text-red-400 disabled:opacity-50"
                title="Supprimer"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
