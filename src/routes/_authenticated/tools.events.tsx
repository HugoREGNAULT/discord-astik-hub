import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, asArray, type EventEntry } from "@/lib/paladium/api";

export const Route = createFileRoute("/_authenticated/tools/events")({
  head: () => ({
    meta: [
      { title: "Agenda Événements · Outils PunkAstik" },
      {
        name: "description",
        content: "Agenda des événements Paladium : KOTH, À vos marques, prochains événements.",
      },
    ],
  }),
  component: EventsPage,
});

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "en cours";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(ts: number): string {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeEvent(e: EventEntry & { [k: string]: unknown }): {
  name: string;
  type: string;
  startMs: number | null;
  endMs: number | null;
} {
  const name = String(e.name ?? e.type ?? e.id ?? "Événement");
  const type = String(e.type ?? "");
  function toMs(v: unknown): number | null {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return v < 1e12 ? v * 1000 : v;
  }
  return {
    name,
    type,
    startMs: toMs(e.startAt ?? e.start ?? e.beginAt ?? e.startTime),
    endMs: toMs(e.endAt ?? e.end ?? e.finishAt ?? e.endTime),
  };
}

function EventsPage() {
  const upcoming = useQuery({
    queryKey: ["pala-events-upcoming"],
    queryFn: () => PaladiumApi.getUpcomingEvents(),
    staleTime: 60_000,
    retry: false,
  });
  const all = useQuery({
    queryKey: ["pala-events"],
    queryFn: () => PaladiumApi.getEvents(),
    staleTime: 60_000,
    retry: false,
  });
  const onYourMark = useQuery({
    queryKey: ["pala-oym"],
    queryFn: () => PaladiumApi.getOnYourMark(),
    staleTime: 60_000,
    retry: false,
  });

  const upcomingList = useMemo(
    () => asArray<EventEntry>(upcoming.data ?? null).map(normalizeEvent),
    [upcoming.data],
  );
  const allList = useMemo(
    () => asArray<EventEntry>(all.data ?? null).map(normalizeEvent),
    [all.data],
  );

  const now = Date.now();
  const sorted = [...upcomingList, ...allList]
    .filter((e) => e.startMs && e.startMs > now)
    .sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0));

  const next = sorted[0];

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.events"
        title="Agenda événements"
        description="KOTH, À vos marques et autres événements Paladium à venir."
      />

      {next && (
        <ToolCard className="border-pink-500/40">
          <div
            className="text-[10px] uppercase tracking-[0.3em] text-pink-400 mb-2"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // prochain
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div
                className="text-xl font-bold text-white"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {next.name}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {next.startMs ? fmtDate(next.startMs) : "—"}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-3xl font-bold text-pink-400"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {next.startMs ? fmtCountdown(next.startMs - now) : "—"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                avant lancement
              </div>
            </div>
          </div>
        </ToolCard>
      )}

      <ToolCard>
        <div
          className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // calendrier
        </div>
        {(upcoming.isLoading || all.isLoading) && <LoadingBlock />}
        {upcoming.error && <ErrorBlock message={(upcoming.error as Error).message} />}
        {!upcoming.isLoading && sorted.length === 0 && (
          <EmptyBlock label="Aucun événement à venir" />
        )}
        {sorted.length > 0 && (
          <ul className="divide-y divide-zinc-800">
            {sorted.map((e, i) => (
              <li key={i} className="py-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-sm text-white font-medium">{e.name}</div>
                  {e.type && (
                    <div
                      className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-0.5"
                      style={{ fontFamily: "'Space Mono'" }}
                    >
                      {e.type}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-200">
                    {e.startMs ? fmtDate(e.startMs) : "—"}
                  </div>
                  <div className="text-[11px] text-pink-400 font-mono">
                    {e.startMs ? fmtCountdown(e.startMs - now) : "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ToolCard>

      <ToolCard>
        <div
          className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // à vos marques
        </div>
        {onYourMark.data ? (
          <pre className="text-[11px] text-zinc-400 font-mono overflow-x-auto max-h-96">
            {JSON.stringify(onYourMark.data, null, 2)}
          </pre>
        ) : null}
        {onYourMark.isLoading && <LoadingBlock />}
        {onYourMark.error && <ErrorBlock message={(onYourMark.error as Error).message} />}
      </ToolCard>
    </div>
  );
}
