import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Mic, MessageSquare, Crown, Medal, Award } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberRowsSkeleton as LeaderboardRowsSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Search as SearchIcon } from "lucide-react";
import {
  getLeaderboard,
  getLeaderboardHistory,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from "@/lib/data/leaderboard.functions";
import { LeaderboardChart } from "@/components/LeaderboardChart";
import { RecentCartsPanel } from "@/components/RecentCartsPanel";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { PageHeader, PageCard, DaChip } from "@/components/tools/ToolsUi";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Classement · PunkAstik" }] }),
  component: LeaderboardPage,
});

function formatVoice(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}m`;
}

function getValue(e: LeaderboardEntry, metric: LeaderboardMetric, period: "all" | "7d") {
  if (metric === "points") return e.astik_points;
  if (metric === "voice") return period === "7d" ? e.voice_7d_seconds : e.voice_total_seconds;
  return period === "7d" ? e.messages_7d : e.messages_total;
}

function formatValue(value: number, metric: LeaderboardMetric) {
  if (metric === "voice") return formatVoice(value);
  return value.toLocaleString("fr-FR");
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="size-4 text-yellow-400" />;
  if (rank === 2) return <Medal className="size-4 text-zinc-300" />;
  if (rank === 3) return <Award className="size-4 text-amber-600" />;
  return null;
}

function LeaderboardList({
  entries,
  metric,
  period,
  query,
  rankOffset = 0,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
  period: "all" | "7d";
  query: string;
  rankOffset?: number;
}) {
  const sorted = useMemo(() => {
    const arr = [...entries].sort(
      (a, b) => getValue(b, metric, period) - getValue(a, metric, period),
    );
    const needle = query.trim().toLowerCase();
    if (!needle) return arr;
    return arr.filter(
      (e) =>
        (e.ig_name ?? "").toLowerCase().includes(needle) ||
        (e.discord_username ?? "").toLowerCase().includes(needle),
    );
  }, [entries, metric, period, query]);

  return (
    <div className="space-y-1">
      {sorted.map((e, i) => {
        const rank = i + 1 + rankOffset;
        const value = getValue(e, metric, period);

        return (
          <div
            key={e.discord_id}
            className="flex items-center gap-3 rounded-md border border-border/50 bg-card/40 px-3 py-2 hover:border-primary/40 transition"
          >
            <div className="flex items-center gap-2 w-12 shrink-0">
              <span className="font-mono text-sm text-muted-foreground w-6 text-right">
                #{rank}
              </span>
              {rankIcon(rank)}
            </div>
            <Avatar className="size-8">
              <AvatarImage src={e.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">
                {(e.ig_name ?? e.discord_username ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {e.ig_name ?? e.discord_username ?? e.discord_id}
              </div>
              {e.current_grade && <DaChip accent="blurple">{e.current_grade}</DaChip>}
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums">
              {formatValue(value, metric)}
            </div>
          </div>
        );
      })}
      {sorted.length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="Aucun résultat"
          description="Essaie d'ajuster la recherche ou les filtres."
        />
      )}
    </div>
  );
}

function LeaderboardPage() {
  const fetchLb = useServerFn(getLeaderboard);
  const fetchHist = useServerFn(getLeaderboardHistory);
  const { data: currentUser } = useCurrentUser();
  const canSeeCarts = hasPerm(currentUser, "donations.manage");
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLb(),
    refetchInterval: 60_000,
  });
  const { data: histData } = useQuery({
    queryKey: ["leaderboard-history"],
    queryFn: () => fetchHist(),
    refetchInterval: 60_000,
  });
  const [metric, setMetric] = useState<LeaderboardMetric>("points");
  const [period, setPeriod] = useState<"all" | "7d">("all");
  const [query, setQuery] = useState("");

  const entries = data?.entries ?? [];
  const sortedAll = useMemo(
    () => [...entries].sort((a, b) => getValue(b, metric, period) - getValue(a, metric, period)),
    [entries, metric, period],
  );
  const top3 = sortedAll.slice(0, 3);
  const rest = sortedAll.slice(3);
  return (
    <div className="space-y-5">
      <PageHeader
        code="// dashboard.leaderboard"
        title="Classement"
        description="Le top de la faction — AstikPoints, vocal et messages."
      />

      <PageCard>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <MetricTabs
            options={[
              { value: "points", label: "Points", icon: Coins },
              { value: "voice", label: "Vocal", icon: Mic },
              { value: "messages", label: "Messages", icon: MessageSquare },
            ]}
            value={metric}
            onChange={(v) => setMetric(v as LeaderboardMetric)}
          />
          {metric !== "points" && (
            <MetricTabs
              options={[
                { value: "all", label: "Total" },
                { value: "7d", label: "7 jours" },
              ]}
              value={period}
              onChange={(v) => setPeriod(v as "all" | "7d")}
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-2">
            {top3.map((e, i) => {
              const rank = i + 1;
              const value = getValue(e, metric, period);
              return (
                <div
                  key={e.discord_id}
                  className="flex items-center gap-3 border border-pink-500/30 bg-pink-500/5 px-3 py-2"
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="font-mono text-xs text-zinc-500"
                      style={{ fontFamily: "'Space Mono'" }}
                    >
                      #{rank}
                    </span>
                    {rankIcon(rank)}
                  </div>
                  <Avatar className="size-8">
                    <AvatarImage src={e.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(e.ig_name ?? e.discord_username ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-bold uppercase tracking-tight text-white truncate"
                      style={{ fontFamily: "'Space Grotesk'" }}
                    >
                      {e.ig_name ?? e.discord_username ?? e.discord_id}
                    </div>
                    <div className="font-mono text-xs text-pink-400">
                      {formatValue(value, metric)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <LeaderboardChart
            snapshots={histData?.snapshots ?? []}
            topEntries={top3}
            metric={metric}
            period={period}
          />

          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2
                className="text-[10px] uppercase tracking-[0.3em] text-pink-500"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // à partir du rang 4
              </h2>
              <input
                placeholder="Rechercher un membre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="max-w-xs bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-pink-500 focus:outline-none font-mono"
              />
            </div>
            {isLoading ? (
              <LeaderboardRowsSkeleton count={10} />
            ) : (
              <LeaderboardList
                entries={rest}
                metric={metric}
                period={period}
                query={query}
                rankOffset={3}
              />
            )}
          </div>
        </div>
      </PageCard>

      {canSeeCarts && <RecentCartsPanel />}
    </div>
  );
}

function MetricTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: any }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex border border-zinc-800 bg-zinc-950">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-colors ${
              active ? "bg-pink-500 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
            style={{ fontFamily: "'Space Mono'" }}
          >
            {Icon && <Icon className="size-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
