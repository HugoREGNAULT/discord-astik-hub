import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ToolHeader,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  StatTile,
  SearchInput,
} from "@/components/tools/ToolsUi";
import { resolveUuid, avatarUrl } from "@/lib/paladium/api";
import {
  trackPlayerSearch,
  getPlayerSalesHistory,
  getTopSearchedPlayers,
} from "@/lib/paladium/tracked-players.functions";

export const Route = createFileRoute("/_authenticated/tools/sales")({
  head: () => ({
    meta: [
      { title: "Ventes joueur · Outils PunkAstik" },
      {
        name: "description",
        content:
          "Recherche un joueur par pseudo ou UUID et affiche ses ventes HDV en cours et passées avec filtres.",
      },
    ],
  }),
  component: PlayerSales,
});

const UUID_RE =
  /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

function normalizeUuid(raw: string): string | null {
  const s = raw.trim();
  if (!UUID_RE.test(s)) return null;
  const stripped = s.replace(/-/g, "");
  return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(
    12,
    16,
  )}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
}

type Row = {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  price_pb: number | null;
  listed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  sold_at: string | null;
};

type Tab = "open" | "sold" | "all";
type Sort = "recent" | "price_desc" | "price_asc" | "unit_desc" | "unit_asc";

function fmtInt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PlayerSales() {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<
    | { mode: "uuid"; uuid: string }
    | { mode: "name"; username: string }
    | null
  >(null);

  const [tab, setTab] = useState<Tab>("open");
  const [itemFilter, setItemFilter] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const queryClient = useQueryClient();

  const onSubmit = (raw: string) => {
    const s = raw.trim();
    if (!s) return;
    const normalized = normalizeUuid(s);
    if (normalized) setTarget({ mode: "uuid", uuid: normalized });
    else setTarget({ mode: "name", username: s });
  };

  const uuidQ = useQuery({
    queryKey: ["mojang-resolve", target?.mode === "name" ? target.username : null],
    queryFn: () =>
      resolveUuid((target as { mode: "name"; username: string }).username),
    enabled: target?.mode === "name",
    retry: false,
    staleTime: 60_000,
  });

  const uuid =
    target?.mode === "uuid"
      ? target.uuid
      : uuidQ.data?.id ?? undefined;
  const resolvedName =
    target?.mode === "name" ? uuidQ.data?.name : undefined;

  // Track search → triggers a background snapshot too.
  useEffect(() => {
    if (uuid) {
      const name = resolvedName ?? (target?.mode === "uuid" ? target.uuid.slice(0, 8) : "");
      trackPlayerSearch({ data: { uuid, username: name || "unknown" } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["pala-sales-history", uuid] });
          queryClient.invalidateQueries({ queryKey: ["pala-top-searched"] });
        })
        .catch(() => {});
    }
  }, [uuid, resolvedName, target, queryClient]);

  const historyQ = useQuery({
    queryKey: ["pala-sales-history", uuid],
    queryFn: () => getPlayerSalesHistory({ data: { uuid: uuid! } }),
    enabled: !!uuid,
    refetchInterval: 60_000,
  });

  const topQ = useQuery({
    queryKey: ["pala-top-searched"],
    queryFn: () => getTopSearchedPlayers(),
    staleTime: 60_000,
  });

  const open = (historyQ.data?.open ?? []) as Row[];
  const sold = (historyQ.data?.sold ?? []) as Row[];

  const baseRows = tab === "open" ? open : tab === "sold" ? sold : [...open, ...sold];

  const filtered = useMemo(() => {
    const needle = itemFilter.trim().toLowerCase();
    const arr = needle
      ? baseRows.filter((r) => r.item_name.toLowerCase().includes(needle))
      : baseRows.slice();
    arr.sort((a, b) => {
      const ua = a.quantity ? a.price / a.quantity : a.price;
      const ub = b.quantity ? b.price / b.quantity : b.price;
      switch (sort) {
        case "price_desc":
          return b.price - a.price;
        case "price_asc":
          return a.price - b.price;
        case "unit_desc":
          return ub - ua;
        case "unit_asc":
          return ua - ub;
        case "recent":
        default: {
          const ka = a.sold_at ?? a.last_seen_at ?? a.first_seen_at;
          const kb = b.sold_at ?? b.last_seen_at ?? b.first_seen_at;
          return new Date(kb).getTime() - new Date(ka).getTime();
        }
      }
    });
    return arr;
  }, [baseRows, itemFilter, sort]);

  const totals = useMemo(() => {
    const openTotal = open.reduce((s, r) => s + r.price, 0);
    const soldTotal = sold.reduce((s, r) => s + r.price, 0);
    return { openTotal, soldTotal };
  }, [open, sold]);

  const isLoading =
    (target?.mode === "name" && uuidQ.isLoading) ||
    (!!uuid && historyQ.isLoading);
  const errorMsg =
    (target?.mode === "name" && uuidQ.error
      ? (uuidQ.error as Error).message
      : null) ?? null;

  return (
    <div className="max-w-6xl space-y-6">
      <ToolHeader
        code="// tools.sales"
        title="Ventes joueur"
        description="Recherche par pseudo ou UUID. Affiche les ventes HDV en cours et passées avec filtres et historique."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <SearchInput
            value={input}
            onChange={setInput}
            onSubmit={() => onSubmit(input)}
            placeholder="Pseudo Minecraft ou UUID…"
          />

        {topQ.data?.players.length ? (
          <div className="flex flex-wrap gap-1.5 sm:max-w-[60%]">
            {topQ.data.players.slice(0, 8).map((p) => (
              <button
                key={p.uuid}
                onClick={() => {
                  setInput(p.username);
                  setTarget({ mode: "uuid", uuid: p.uuid });
                }}
                className="px-2 py-1 rounded border border-zinc-800 text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-pink-400 hover:border-pink-500/40"
                style={{ fontFamily: "'Space Mono'" }}
                title={`${p.search_count} recherches`}
              >
                {p.username}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {errorMsg && <ErrorBlock message={errorMsg} />}

      {!target && (
        <EmptyBlock label="Entre un pseudo ou un UUID pour voir les ventes du joueur." />
      )}

      {isLoading && <LoadingBlock label="Récupération…" />}

      {uuid && !historyQ.isLoading && (
        <>
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl(uuid)}
              alt=""
              className="w-12 h-12 rounded border border-zinc-800"
            />
            <div>
              <div className="text-white text-lg">
                {resolvedName ?? "Joueur"}
              </div>
              <div
                className="text-[10px] text-zinc-500 uppercase tracking-[0.25em]"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {uuid}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Ventes en cours" value={fmtInt(open.length)} />
            <StatTile label="Ventes passées" value={fmtInt(sold.length)} />
            <StatTile
              label="$ listé (en cours)"
              value={fmtInt(totals.openTotal)}
            />
            <StatTile
              label="$ vendu (historique)"
              value={fmtInt(totals.soldTotal)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-1">
              {(
                [
                  ["open", "En cours"],
                  ["sold", "Passées"],
                  ["all", "Tout"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border ${
                    tab === k
                      ? "border-pink-500 text-pink-400"
                      : "border-zinc-800 text-zinc-500 hover:text-white"
                  }`}
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                placeholder="Filtrer par item…"
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/60"
                style={{ fontFamily: "'Space Mono'" }}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="px-2 py-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-pink-500/60"
                style={{ fontFamily: "'Space Mono'" }}
              >
                <option value="recent">Récent</option>
                <option value="price_desc">Prix total ↓</option>
                <option value="price_asc">Prix total ↑</option>
                <option value="unit_desc">Prix unitaire ↓</option>
                <option value="unit_asc">Prix unitaire ↑</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyBlock label="Aucune vente à afficher." />
          ) : (
            <div className="border border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-zinc-950/60 text-zinc-500">
                  <tr style={{ fontFamily: "'Space Mono'" }}>
                    <th className="text-left px-3 py-2 uppercase tracking-[0.18em]">Item</th>
                    <th className="text-right px-3 py-2 uppercase tracking-[0.18em]">Qté</th>
                    <th className="text-right px-3 py-2 uppercase tracking-[0.18em]">Prix</th>
                    <th className="text-right px-3 py-2 uppercase tracking-[0.18em]">Unitaire</th>
                    <th className="text-left px-3 py-2 uppercase tracking-[0.18em]">Listé</th>
                    <th className="text-left px-3 py-2 uppercase tracking-[0.18em]">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const unit = r.quantity ? r.price / r.quantity : r.price;
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-zinc-900 hover:bg-zinc-950/60"
                      >
                        <td className="px-3 py-2 text-white">{r.item_name}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">
                          {fmtInt(r.quantity)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-200">
                          {fmtInt(r.price)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400">
                          {fmtInt(unit)}
                        </td>
                        <td className="px-3 py-2 text-zinc-500">
                          {fmtDate(r.listed_at ?? r.first_seen_at)}
                        </td>
                        <td className="px-3 py-2">
                          {r.sold_at ? (
                            <span className="text-emerald-400">
                              vendu · {fmtDate(r.sold_at)}
                            </span>
                          ) : (
                            <span className="text-pink-400">en cours</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-zinc-600" style={{ fontFamily: "'Space Mono'" }}>
            Snapshot auto toutes les 10 min ; les ventes disparues sont marquées comme passées.
          </p>
        </>
      )}
    </div>
  );
}
