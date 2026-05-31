import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
const UptimePlayersChart = lazy(() =>
  import("./-tools.uptime.chart").then((m) => ({ default: m.UptimePlayersChart })),
);
const UptimeStatusChart = lazy(() =>
  import("./-tools.uptime.chart").then((m) => ({ default: m.UptimeStatusChart })),
);
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { useServerFn } from "@tanstack/react-start";
import { getStatusHistory } from "@/lib/paladium/history.functions";

export const Route = createFileRoute("/_authenticated/tools/uptime")({
  head: () => ({
    meta: [
      { title: "Uptime serveurs · Outils PunkAstik" },
      {
        name: "description",
        content: "Suivi de disponibilité et de fréquentation des serveurs Paladium.",
      },
    ],
  }),
  component: UptimePage,
});

type Row = {
  server_key: string;
  server_label: string | null;
  online_players: number | null;
  is_online: boolean;
  captured_at: string;
};

const RANGES: { key: "1d" | "7d" | "30d"; label: string; days: number }[] = [
  { key: "1d", label: "24h", days: 1 },
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
];

function UptimePage() {
  const fetchHistory = useServerFn(getStatusHistory);
  const [range, setRange] = useState<"1d" | "7d" | "30d">("7d");
  const days = RANGES.find((r) => r.key === range)!.days;

  const q = useQuery({
    queryKey: ["pala-status-history", days],
    queryFn: () => fetchHistory({ data: { days } }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const rows: Row[] = q.data?.rows ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = map.get(r.server_key) ?? [];
      arr.push(r);
      map.set(r.server_key, arr);
    }
    return Array.from(map.entries())
      .map(([key, list]) => {
        const total = list.length;
        const onlineCount = list.filter((r) => r.is_online).length;
        const uptimePct = total > 0 ? Math.round((onlineCount / total) * 1000) / 10 : 0;
        const last = list[list.length - 1];
        return {
          key,
          label: list[0]?.server_label ?? key,
          uptimePct,
          lastOnline: last?.online_players ?? null,
          isOnline: last?.is_online ?? false,
          series: list.map((r) => ({
            t: new Date(r.captured_at).getTime(),
            players: r.online_players ?? 0,
            up: r.is_online ? 1 : 0,
          })),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // Aggregate "Total joueurs Paladium" = java.global series
  const globalSeries = useMemo(
    () => grouped.find((g) => g.key === "java.global")?.series ?? [],
    [grouped],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const current = grouped.find((g) => g.key === selected) ?? grouped[0];

  return (
    <div className="max-w-6xl space-y-5">
      <ToolHeader
        code="// tools.uptime"
        title="Uptime serveurs"
        description="Snapshot toutes les 5 min. Disponibilité (up/down) et joueurs en ligne par serveur."
      />

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border transition-colors ${
              range === r.key
                ? "border-pink-500 bg-pink-500/10 text-pink-300"
                : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700"
            }`}
            style={{ fontFamily: "'Space Mono'" }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}
      {!q.isLoading && grouped.length === 0 && (
        <EmptyBlock label="Aucun snapshot — attends le prochain passage du cron (5 min)." />
      )}

      {globalSeries.length > 0 && (
        <ToolCard>
          <div
            className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // joueurs connectés Paladium (global) — {RANGES.find((r) => r.key === range)?.label}
          </div>
          <div className="h-64">
            <Suspense fallback={<div className="h-full animate-pulse rounded-md bg-muted" />}>
              <UptimePlayersChart data={globalSeries} days={days} />
            </Suspense>
          </div>
        </ToolCard>
      )}

      {grouped.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {grouped.map((g) => (
              <button
                type="button"
                key={g.key}
                onClick={() => setSelected(g.key)}
                className={`text-left border p-3 transition-colors ${
                  current?.key === g.key
                    ? "border-pink-500 bg-pink-500/5"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      g.isOnline ? "bg-emerald-400" : "bg-red-500"
                    }`}
                  />
                  <span
                    className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 truncate"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {g.key}
                  </span>
                </div>
                <div className="text-sm text-white font-bold truncate">{g.label}</div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-zinc-400">
                    {g.lastOnline ?? "—"} <span className="text-zinc-600">joueurs</span>
                  </span>
                  <span
                    className={
                      g.uptimePct >= 95
                        ? "text-emerald-400"
                        : g.uptimePct >= 70
                          ? "text-amber-400"
                          : "text-red-400"
                    }
                  >
                    {g.uptimePct}%
                  </span>
                </div>
              </button>
            ))}
          </div>

          {current && (
            <ToolCard>
              <div
                className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // {current.label} — up/down (ultime) sur{" "}
                {RANGES.find((r) => r.key === range)?.label}
              </div>
              <div className="h-48">
                <Suspense fallback={<div className="h-full animate-pulse rounded-md bg-muted" />}>
                  <UptimeStatusChart data={current.series} days={days} />
                </Suspense>
              </div>
              {current.series.some((p) => p.players > 0) && (
                <>
                  <div
                    className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-4 mb-2"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    // joueurs en ligne
                  </div>
                  <div className="h-48">
                    <Suspense fallback={<div className="h-full animate-pulse rounded-md bg-muted" />}>
                      <UptimePlayersChart data={current.series} days={days} />
                    </Suspense>
                  </div>
                </>
              )}
            </ToolCard>
          )}
        </>
      )}
    </div>
  );
}
