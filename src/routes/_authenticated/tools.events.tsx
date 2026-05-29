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
        content:
          "Agenda Paladium : Boss, Egghunt, KOTH à gauche — À vos marques et Quête de faction à droite.",
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

function toMs(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v < 1e12 ? v * 1000 : v;
}

function normalizeEvent(e: EventEntry & { [k: string]: unknown }): {
  name: string;
  type: string;
  startMs: number | null;
  endMs: number | null;
} {
  const name = String(e.name ?? e.type ?? e.id ?? "Événement");
  const type = String(e.type ?? "");
  return {
    name,
    type,
    startMs: toMs(e.startAt ?? e.start ?? e.beginAt ?? e.startTime),
    endMs: toMs(e.endAt ?? e.end ?? e.finishAt ?? e.endTime),
  };
}

type OymData = {
  goalType?: string;
  extra?: string;
  amount?: number;
  rewardElo?: number;
  serverType?: string;
  start?: number;
  end?: number;
  state?: string;
};

type QuestData = {
  item?: string;
  quantity?: number;
  start?: number;
  end?: number;
  earningXp?: number;
  earningMoney?: number;
};

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
    queryFn: () => PaladiumApi.getOnYourMark() as Promise<OymData>,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const quest = useQuery({
    queryKey: ["pala-quest"],
    queryFn: () => PaladiumApi.getFactionQuest() as Promise<QuestData>,
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

  const oymStart = toMs(onYourMark.data?.start);
  const oymEnd = toMs(onYourMark.data?.end);
  const questStart = toMs(quest.data?.start);
  const questEnd = toMs(quest.data?.end);

  return (
    <div className="max-w-7xl space-y-5">
      <ToolHeader
        code="// tools.events"
        title="Agenda événements"
        description="Boss, Egghunt, KOTH à gauche — À vos marques et Quête de faction à droite."
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT — Calendar (Boss / Egghunt / KOTH …) */}
        <ToolCard>
          <div
            className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // calendrier (boss · egghunt · koth …)
          </div>
          {(upcoming.isLoading || all.isLoading) && <LoadingBlock />}
          {upcoming.error && <ErrorBlock message={(upcoming.error as Error).message} />}
          {!upcoming.isLoading && sorted.length === 0 && (
            <EmptyBlock label="Aucun événement à venir" />
          )}
          {sorted.length > 0 && (
            <ul className="divide-y divide-zinc-800 max-h-[640px] overflow-y-auto">
              {sorted.map((e, i) => (
                <li
                  key={i}
                  className="py-3 flex flex-wrap items-baseline justify-between gap-2"
                >
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

        {/* RIGHT — À vos marques + Quête de faction */}
        <div className="space-y-5">
          {/* À vos marques */}
          <ToolCard>
            <div
              className="text-[10px] uppercase tracking-[0.3em] text-pink-400 mb-3"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // à vos marques
            </div>
            {onYourMark.isLoading && <LoadingBlock />}
            {onYourMark.error && (
              <ErrorBlock message={(onYourMark.error as Error).message} />
            )}
            {onYourMark.data && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div
                      className="text-lg font-bold text-white"
                      style={{ fontFamily: "'Space Grotesk'" }}
                    >
                      {onYourMark.data.goalType ?? "—"}
                    </div>
                    {onYourMark.data.extra && (
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">
                        {onYourMark.data.extra}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded ${
                      onYourMark.data.state === "STARTED"
                        ? "bg-pink-500/20 text-pink-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {onYourMark.data.state ?? "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="quantité" value={onYourMark.data.amount} />
                  <Stat label="récompense elo" value={onYourMark.data.rewardElo} />
                  <Stat label="serveur" value={onYourMark.data.serverType} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-zinc-500">Début</div>
                    <div className="text-zinc-200">
                      {oymStart ? fmtDate(oymStart) : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-500">
                      {oymStart && oymStart > now ? "commence dans" : "se termine dans"}
                    </div>
                    <div className="text-pink-400 font-mono">
                      {oymStart && oymStart > now
                        ? fmtCountdown(oymStart - now)
                        : oymEnd
                          ? fmtCountdown(oymEnd - now)
                          : "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ToolCard>

          {/* Quête de faction */}
          <ToolCard>
            <div
              className="text-[10px] uppercase tracking-[0.3em] text-pink-400 mb-3"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // quête de faction
            </div>
            {quest.isLoading && <LoadingBlock />}
            {quest.error && (
              <EmptyBlock
                label={
                  /No current quest/i.test((quest.error as Error).message)
                    ? "Aucune quête active actuellement."
                    : (quest.error as Error).message
                }
              />
            )}
            {quest.data && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "'Space Grotesk'" }}
                  >
                    {quest.data.item ?? "—"}
                  </div>
                  <div className="text-2xl font-bold text-pink-400 font-mono">
                    ×{quest.data.quantity?.toLocaleString("fr-FR") ?? "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <Stat
                    label="xp"
                    value={quest.data.earningXp?.toLocaleString("fr-FR")}
                  />
                  <Stat
                    label="money"
                    value={
                      quest.data.earningMoney != null
                        ? `${quest.data.earningMoney.toLocaleString("fr-FR")} $`
                        : undefined
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-zinc-500">Début</div>
                    <div className="text-zinc-200">
                      {questStart ? fmtDate(questStart) : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-500">Fin</div>
                    <div className="text-zinc-200">
                      {questEnd ? fmtDate(questEnd) : "—"}
                    </div>
                    {questEnd && questEnd > now && (
                      <div className="text-pink-400 font-mono mt-0.5">
                        {fmtCountdown(questEnd - now)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </ToolCard>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded px-2 py-2">
      <div
        className="text-[9px] uppercase tracking-[0.2em] text-zinc-500"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {label}
      </div>
      <div className="text-sm font-bold text-white mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
