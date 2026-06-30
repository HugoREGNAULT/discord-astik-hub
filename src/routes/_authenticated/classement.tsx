import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getFactionLeaderboard,
  refreshFactionMemberStats,
} from "@/lib/data/faction-leaderboard.functions";
import type { FactionLeaderboardEntry } from "@/lib/data/faction-leaderboard.functions";
import { PageCard, SectionLabel, MonoLabel, DaButton, DaChip } from "@/components/tools/ToolsUi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DetailPageSkeleton } from "@/components/Skeletons";
import { toUserMessage } from "@/lib/errors";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/classement")({
  head: () => ({ meta: [{ title: "Classement faction · PunkAstik" }] }),
  component: ClassementPage,
});

// ─── Formatters ─────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtInt = (n: number) => String(n);
const fmtTimePlayed = (n: number) => `${Math.floor(n / 60)}h`;

// ─── Tabs definition ─────────────────────────────────────────────────────────

type TabDef = {
  id: string;
  label: string;
  getValue: (e: FactionLeaderboardEntry) => number | null;
  formatValue: (n: number) => string;
  /** Si vrai, la valeur est masquée (timePlayed = -1) → "Masqué", trié en bas */
  isHidden?: (n: number) => boolean;
  /** Clé dans server_ranking pour le badge "#N srv" */
  rankingKey?: string;
};

const TABS: TabDef[] = [
  {
    id: "argent",
    label: "ARGENT",
    getValue: (e) => e.money,
    formatValue: fmtMoney,
    rankingKey: "money",
  },
  {
    id: "miner",
    label: "MINEUR",
    getValue: (e) => e.miner,
    formatValue: fmtInt,
    rankingKey: "miner",
  },
  {
    id: "farmer",
    label: "FARMER",
    getValue: (e) => e.farmer,
    formatValue: fmtInt,
    rankingKey: "farmer",
  },
  {
    id: "hunter",
    label: "HUNTER",
    getValue: (e) => e.hunter,
    formatValue: fmtInt,
    rankingKey: "hunter",
  },
  {
    id: "alchemist",
    label: "ALCHIMISTE",
    getValue: (e) => e.alchemist,
    formatValue: fmtInt,
    rankingKey: "alchemist",
  },
  {
    id: "clicker",
    label: "CLICKER",
    getValue: (e) => e.clicker,
    formatValue: fmtMoney,
    rankingKey: "clicker",
  },
  {
    id: "temps-de-jeu",
    label: "TEMPS DE JEU",
    getValue: (e) => e.time_played,
    formatValue: fmtTimePlayed,
    isHidden: (n) => n === -1,
    rankingKey: "timePlayed",
  },
];

// ─── LeaderboardTable ─────────────────────────────────────────────────────────

function LeaderboardTable({
  entries,
  getValue,
  formatValue,
  isHidden,
  rankingKey,
}: {
  entries: FactionLeaderboardEntry[];
  getValue: (e: FactionLeaderboardEntry) => number | null;
  formatValue: (n: number) => string;
  isHidden?: (n: number) => boolean;
  rankingKey?: string;
}) {
  const sorted = [...entries].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    const aHidden = av === null || (isHidden != null && av !== null && isHidden(av));
    const bHidden = bv === null || (isHidden != null && bv !== null && isHidden(bv));
    if (aHidden && bHidden) return 0;
    if (aHidden) return 1;
    if (bHidden) return -1;
    return (bv as number) - (av as number);
  });

  return (
    <div className="divide-y divide-border">
      {sorted.map((e, i) => {
        const val = getValue(e);
        const hidden = val !== null && isHidden != null && isHidden(val);
        const hasValue = val !== null && !hidden;

        const serverPos =
          rankingKey != null && e.server_ranking?.[rankingKey] != null
            ? (e.server_ranking[rankingKey] as number)
            : null;

        return (
          <div key={e.discord_id} className="flex items-center gap-3 py-2 px-1">
            <span className="text-[9px] font-mono text-muted-foreground/70 w-6 shrink-0 text-right">
              {hasValue ? i + 1 : "—"}
            </span>
            <img
              src={`https://mc-heads.net/avatar/${encodeURIComponent(e.mc_uuid)}/32`}
              className="size-8 border border-border shrink-0"
              alt=""
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-bold uppercase truncate"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {e.ig_name ?? e.discord_username ?? e.discord_id}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {e.current_grade && <DaChip accent="blurple">{e.current_grade}</DaChip>}
                {serverPos !== null && (
                  <span
                    className="text-[9px] font-mono text-muted-foreground/60 border border-border px-1 py-px leading-none"
                    title="Position dans le classement global du serveur"
                  >
                    #{serverPos} srv
                  </span>
                )}
              </div>
            </div>
            <span
              className={`font-mono font-bold text-sm tabular-nums shrink-0 ${
                hasValue
                  ? "text-primary"
                  : hidden
                    ? "text-muted-foreground/40 italic text-xs"
                    : "text-muted-foreground/40"
              }`}
            >
              {hasValue ? formatValue(val as number) : hidden ? "Masqué" : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ClassementPage() {
  const fn = useServerFn(getFactionLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["faction-leaderboard"],
    queryFn: () => fn(),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const refreshFn = useServerFn(refreshFactionMemberStats);
  const qc = useQueryClient();
  const refreshMutation = useMutation({
    mutationFn: () => refreshFn({ data: undefined }),
    onSuccess: (d) => {
      toast.success(`${d.refreshed} rafraîchis · ${d.skipped} en cache`);
      qc.invalidateQueries({ queryKey: ["faction-leaderboard"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const { data: user } = useCurrentUser();

  const entries = data?.entries ?? [];
  const withoutUuid = data?.withoutUuid ?? [];

  if (isLoading) return <DetailPageSkeleton />;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <MonoLabel>// classement.faction</MonoLabel>
          <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "'Space Grotesk'" }}>
            CLASSEMENT FACTION
          </h1>
        </div>

        {hasPerm(user, "admin.access") && (
          <DaButton
            variant="ghost"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="text-[10px]"
          >
            <RefreshCw
              className={`size-3 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
            {refreshMutation.isPending ? "Rafraîchissement…" : "Rafraîchir les stats"}
          </DaButton>
        )}
      </div>

      {/* Tabs + table */}
      <PageCard>
        <Tabs defaultValue="argent">
          <TabsList className="rounded-none border border-border bg-transparent h-auto flex-wrap gap-0 p-0 mb-4">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="rounded-none border-r border-border last:border-r-0 data-[state=active]:bg-primary data-[state=active]:text-white uppercase text-[11px] tracking-wider px-3 py-2"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              <LeaderboardTable
                entries={entries}
                getValue={t.getValue}
                formatValue={t.formatValue}
                isHidden={t.isHidden}
                rankingKey={t.rankingKey}
              />
            </TabsContent>
          ))}
        </Tabs>
      </PageCard>

      {/* Sans profil MC */}
      {withoutUuid.length > 0 && (
        <PageCard>
          <SectionLabel>sans profil mc</SectionLabel>
          <div className="divide-y divide-border">
            {withoutUuid.map((m) => (
              <div key={m.discord_id} className="flex items-center gap-3 py-2 px-1">
                {m.avatar_url ? (
                  <img src={m.avatar_url} className="size-8 border border-border shrink-0" alt="" />
                ) : (
                  <div className="size-8 bg-secondary border border-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-bold uppercase truncate"
                    style={{ fontFamily: "'Space Grotesk'" }}
                  >
                    {m.ig_name ?? m.discord_username}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    @{m.discord_username}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">
                  pseudo IG manquant
                </span>
              </div>
            ))}
          </div>
        </PageCard>
      )}
    </div>
  );
}
