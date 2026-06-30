import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPointsLeaderboard,
  type LeaderboardEntry,
} from "@/lib/data/points-leaderboard.functions";
import { ComparisonPointsChart } from "@/components/points/PointsChart";
import { PageHeader, PageCard, SectionLabel, EmptyBlock } from "@/components/tools/ToolsUi";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/classement-points")({
  head: () => ({ meta: [{ title: "Classement Points · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <PointsLeaderboardPage />
    </Guard>
  ),
});

function RankChange({ change }: { change: number | null }) {
  if (change === null) return null;
  if (change === 0)
    return (
      <span
        className="text-muted-foreground text-[10px] tabular-nums"
        style={{ fontFamily: "'Space Mono'" }}
      >
        ═
      </span>
    );
  if (change > 0)
    return (
      <span
        className="text-emerald-400 text-[10px] tabular-nums"
        style={{ fontFamily: "'Space Mono'" }}
      >
        ▲{change}
      </span>
    );
  return (
    <span className="text-red-400 text-[10px] tabular-nums" style={{ fontFamily: "'Space Mono'" }}>
      ▼{Math.abs(change)}
    </span>
  );
}

const MEDAL: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-300",
  3: "text-amber-600",
};

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const medal = MEDAL[entry.rank] ?? "text-muted-foreground/60";
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 ${
        isMe ? "bg-primary/10 border-l-[3px] border-l-primary" : ""
      }`}
    >
      <span
        className={`w-8 shrink-0 text-[11px] tabular-nums font-bold ${medal}`}
        style={{ fontFamily: "'Space Mono'" }}
      >
        #{entry.rank}
      </span>
      {entry.avatar_url ? (
        <img src={entry.avatar_url} className="size-8 border border-border shrink-0" alt="" />
      ) : (
        <div className="size-8 bg-secondary border border-border shrink-0" />
      )}
      <span
        className="flex-1 min-w-0 text-sm font-bold uppercase tracking-tight truncate"
        style={{ fontFamily: "'Space Grotesk'" }}
      >
        {entry.ig_name ?? entry.discord_username ?? entry.discord_id}
        {isMe && (
          <span
            className="ml-2 text-[9px] text-primary uppercase tracking-[0.2em] font-normal"
            style={{ fontFamily: "'Space Mono'" }}
          >
            [toi]
          </span>
        )}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <RankChange change={entry.rankChange} />
        <span
          className="text-primary font-bold tabular-nums text-base"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          {entry.astik_points}
        </span>
        <span
          className="hidden sm:block text-[9px] text-muted-foreground uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Space Mono'" }}
        >
          pts
        </span>
      </div>
    </li>
  );
}

function PointsLeaderboardPage() {
  const fn = useServerFn(getPointsLeaderboard);
  const { data: user } = useCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ["points-leaderboard"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const top10Ids = data?.top10Timelines.map((t) => t.discord_id) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        code="// classement.points"
        title="Classement Points"
        description="Évolution et classement des AstikPoints — membres actifs, hors staff."
      />

      <PageCard>
        <SectionLabel>top 10 — évolution</SectionLabel>
        {isLoading && <div className="h-64 animate-pulse bg-muted" />}
        {error && <p className="text-xs text-red-400 font-mono">Erreur de chargement</p>}
        {!isLoading && !error && data && (
          <>
            {data.top10Timelines.length === 0 ? (
              <EmptyBlock label="Aucune donnée" />
            ) : (
              <>
                <ComparisonPointsChart timelines={data.top10Timelines} selected={top10Ids} />
                {/* Légende */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  {data.top10Timelines.map((t, i) => {
                    const PALETTE = [
                      "#8b5cf6",
                      "#a78bfa",
                      "#c4b5fd",
                      "#7c3aed",
                      "#6d28d9",
                      "#5b21b6",
                      "#ddd6fe",
                      "#ede9fe",
                      "#9061f9",
                      "#4c1d95",
                    ];
                    return (
                      <div key={t.discord_id} className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3 h-0.5"
                          style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                        />
                        <span
                          className="text-[10px] text-muted-foreground uppercase tracking-wide"
                          style={{ fontFamily: "'Space Mono'" }}
                        >
                          {t.ig_name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </PageCard>

      <PageCard>
        <SectionLabel>classement complet</SectionLabel>
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-muted" />
            ))}
          </div>
        )}
        {!isLoading && !error && data && (
          <>
            {data.leaderboard.length === 0 ? (
              <EmptyBlock label="Aucun membre" />
            ) : (
              <ul>
                {data.leaderboard.map((entry) => (
                  <LeaderboardRow
                    key={entry.discord_id}
                    entry={entry}
                    isMe={entry.discord_id === user?.discordId}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </PageCard>
    </div>
  );
}
