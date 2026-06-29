import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy } from "lucide-react";
import { getFactionIngameLeaderboard } from "@/lib/data/faction-leaderboard.functions";
import { avatarUrl } from "@/lib/paladium/api";
import { PageCard, SectionLabel, MonoLabel } from "@/components/tools/ToolsUi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DetailPageSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/classement")({
  head: () => ({ meta: [{ title: "Classement faction · PunkAstik" }] }),
  component: ClassementPage,
});

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Ordre fixe des métiers connus
const KNOWN_JOBS = ["miner", "farmer", "hunter", "alchemist", "lumberjack", "fisher", "blacksmith"];
const JOB_LABELS: Record<string, string> = {
  miner: "Mineur",
  farmer: "Farmer",
  hunter: "Chasseur",
  alchemist: "Alchimiste",
  lumberjack: "Bûcheron",
  fisher: "Pêcheur",
  blacksmith: "Forgeron",
};

function ClassementPage() {
  const fn = useServerFn(getFactionIngameLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["faction-leaderboard"],
    queryFn: () => fn(),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const entries = data?.entries ?? [];

  // Calcul des onglets dynamiques (métiers disponibles dans les données)
  const availableJobs = (() => {
    const jobSet = new Set<string>();
    for (const entry of entries) {
      for (const key of Object.keys(entry.jobs)) {
        jobSet.add(key);
      }
    }
    const known = KNOWN_JOBS.filter((j) => jobSet.has(j));
    const unknown = [...jobSet].filter((j) => !KNOWN_JOBS.includes(j)).sort();
    return [...known, ...unknown];
  })();

  type TabDef = { id: string; label: string };
  const tabs: TabDef[] = [
    { id: "argent", label: "Argent" },
    { id: "niveau", label: "Niveau" },
    ...availableJobs.map((j) => ({ id: `job_${j}`, label: JOB_LABELS[j] ?? j })),
  ];

  const [tab, setTab] = useState("argent");

  if (isLoading) return <DetailPageSkeleton />;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="mb-2">
        <MonoLabel>// classement faction</MonoLabel>
        <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "'Space Grotesk'" }}>
          Classement in-game
        </h1>
        <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "'Space Mono'" }}>
          Données mises à jour toutes les ~6h via cron · Lecture en cache BDD
        </p>
      </div>

      <PageCard>
        {entries.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Aucune donnée"
            description="Les stats in-game apparaîtront ici après la prochaine synchro."
            variant="compact"
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="rounded-none border border-border bg-transparent h-auto flex-wrap gap-0 p-0 mb-4">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="rounded-none border-r border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase text-[11px] tracking-wider px-3 py-1.5"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Onglet Argent */}
            <TabsContent value="argent">
              <LeaderboardTable
                entries={[...entries].sort((a, b) => {
                  if (a.money === null && b.money === null) return 0;
                  if (a.money === null) return 1;
                  if (b.money === null) return -1;
                  return b.money - a.money;
                })}
                columnLabel="Argent"
                getValue={(e) => (e.money != null ? fmtMoney(e.money) : null)}
              />
            </TabsContent>

            {/* Onglet Niveau */}
            <TabsContent value="niveau">
              <LeaderboardTable
                entries={[...entries].sort((a, b) => {
                  if (a.level === null && b.level === null) return 0;
                  if (a.level === null) return 1;
                  if (b.level === null) return -1;
                  return b.level - a.level;
                })}
                columnLabel="Niveau"
                getValue={(e) => (e.level != null ? String(e.level) : null)}
              />
            </TabsContent>

            {/* Onglets métiers */}
            {availableJobs.map((job) => (
              <TabsContent key={`job_${job}`} value={`job_${job}`}>
                <LeaderboardTable
                  entries={[...entries].sort((a, b) => {
                    const av = a.jobs[job] ?? -1;
                    const bv = b.jobs[job] ?? -1;
                    return bv - av;
                  })}
                  columnLabel={JOB_LABELS[job] ?? job}
                  getValue={(e) => (e.jobs[job] != null ? String(e.jobs[job]) : null)}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PageCard>
    </div>
  );
}

type LeaderboardTableProps = {
  entries: import("@/lib/data/faction-leaderboard.functions").FactionLeaderboardEntry[];
  columnLabel: string;
  getValue: (
    entry: import("@/lib/data/faction-leaderboard.functions").FactionLeaderboardEntry,
  ) => string | null;
};

function LeaderboardTable({ entries, columnLabel, getValue }: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-primary/30">
            <th
              className="text-left px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "'Space Mono'" }}
            >
              #
            </th>
            <th
              className="text-left px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Joueur
            </th>
            <th
              className="text-left px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Grade
            </th>
            <th
              className="text-right px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {columnLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr
              key={entry.mc_uuid || entry.ig_name || i}
              className="border-b border-border/50 hover:bg-muted/20"
            >
              <td className="px-3 py-2 font-mono text-muted-foreground tabular-nums w-10">
                {i + 1}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {entry.mc_uuid && (
                    <img
                      src={avatarUrl(entry.mc_uuid, 32)}
                      className="size-8 border border-border shrink-0"
                      alt=""
                    />
                  )}
                  <span className="font-semibold" style={{ fontFamily: "'Space Grotesk'" }}>
                    {entry.ig_name ?? entry.discord_username ?? "—"}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                {entry.current_grade ? (
                  <Badge
                    variant="secondary"
                    className="rounded-none text-[10px] uppercase tracking-wider"
                  >
                    {entry.current_grade}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-primary tabular-nums">
                {getValue(entry) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
