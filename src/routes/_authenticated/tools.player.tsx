import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  StatTile,
  SearchInput,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import {
  PaladiumApi,
  asArray,
  avatarUrl,
  hasPaladiumKey,
  resolveUuid,
  type PlayerJob,
} from "@/lib/paladium/api";
import {
  trackPlayerSearch,
  getTopSearchedPlayers,
  getPlayerSalesHistory,
} from "@/lib/paladium/tracked-players.functions";

export const Route = createFileRoute("/_authenticated/tools/player")({
  head: () => ({
    meta: [
      { title: "Lookup joueur · Outils PunkAstik" },
      { name: "description", content: "Recherche un joueur Paladium par pseudo." },
    ],
  }),
  component: PlayerLookup,
});

function PlayerLookup() {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const uuidQ = useQuery({
    queryKey: ["mojang", username],
    queryFn: () => resolveUuid(username!),
    enabled: !!username,
    retry: false,
    staleTime: 60_000,
  });
  const uuid = uuidQ.data?.id;
  const resolvedName = uuidQ.data?.name;

  // Track each successful resolution server-side.
  useEffect(() => {
    if (uuid && resolvedName) {
      trackPlayerSearch({ data: { uuid, username: resolvedName } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["pala-top-searched"] });
          queryClient.invalidateQueries({ queryKey: ["pala-sales-history", uuid] });
        })
        .catch(() => {});
    }
  }, [uuid, resolvedName, queryClient]);

  const topQ = useQuery({
    queryKey: ["pala-top-searched"],
    queryFn: () => getTopSearchedPlayers(),
    staleTime: 60_000,
  });

  const profileQ = useQuery({
    queryKey: ["pala-profile", uuid],
    queryFn: () => PaladiumApi.getPlayerProfile(uuid!),
    enabled: !!uuid,
    retry: false,
  });
  const jobsQ = useQuery({
    queryKey: ["pala-jobs", uuid],
    queryFn: () => PaladiumApi.getPlayerJobs(uuid!),
    enabled: !!uuid,
    retry: false,
  });
  const palaQ = useQuery({
    queryKey: ["pala-cliccoins", uuid],
    queryFn: () => PaladiumApi.getPaladiumProfile(uuid!),
    enabled: !!uuid,
    retry: false,
  });
  const salesQ = useQuery({
    queryKey: ["pala-sales-history", uuid],
    queryFn: () => getPlayerSalesHistory({ data: { uuid: uuid! } }),
    enabled: !!uuid,
    retry: false,
    staleTime: 30_000,
  });

  const jobs = asArray<PlayerJob>(jobsQ.data ?? null);

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.player"
        title="Lookup Joueur"
        description="Tape un pseudo Minecraft pour récupérer le profil Paladium complet."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <SearchInput
          value={input}
          onChange={setInput}
          onSubmit={() => setUsername(input.trim() || null)}
          placeholder="Pseudo Minecraft…"
        />
      </ToolCard>

      {topQ.data && topQ.data.players.length > 0 && (
        <ToolCard>
          <SectionTitle>Top joueurs recherchés</SectionTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            {topQ.data.players.map((p) => (
              <button
                key={p.uuid}
                type="button"
                onClick={() => {
                  setInput(p.username);
                  setUsername(p.username);
                }}
                className="flex items-center gap-2 border border-border hover:border-primary bg-background px-2 py-1.5 text-xs text-foreground/80 transition-colors"
                title={`${p.search_count} recherche(s)`}
              >
                <img
                  src={avatarUrl(p.uuid, 24)}
                  alt={p.username}
                  className="w-5 h-5 border border-border"
                />
                <span className="font-mono">{p.username}</span>
                <span className="text-primary font-bold">×{p.search_count}</span>
              </button>
            ))}
          </div>
        </ToolCard>
      )}

      {uuidQ.isFetching && <LoadingBlock label="Résolution UUID…" />}
      {uuidQ.error && <ErrorBlock message={(uuidQ.error as Error).message} />}

      {uuid && (
        <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
          <ToolCard className="flex flex-col items-center text-center">
            <img
              src={avatarUrl(uuid, 128)}
              alt={uuidQ.data?.name}
              className="w-32 h-32 border border-border bg-background"
            />
            <div
              className="mt-3 text-sm font-bold uppercase tracking-tight text-white"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {uuidQ.data?.name}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 break-all"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {uuid}
            </div>
          </ToolCard>

          <div className="space-y-5">
            <ToolCard>
              <SectionTitle>Identité</SectionTitle>
              {profileQ.isLoading && <LoadingBlock />}
              {profileQ.error && <ErrorBlock message={(profileQ.error as Error).message} />}
              {profileQ.data && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  <StatTile
                    label="Faction"
                    value={profileQ.data.factionName ?? profileQ.data.faction ?? "—"}
                    accent="pink"
                  />
                  <StatTile
                    label="Grade"
                    value={
                      (profileQ.data as { factionRank?: string }).factionRank ??
                      profileQ.data.rank ??
                      profileQ.data.grade ??
                      "—"
                    }
                  />
                  <StatTile
                    label="Temps de jeu"
                    value={fmtPlaytime((profileQ.data as { timePlayed?: number }).timePlayed)}
                  />
                  <StatTile
                    label="Argent"
                    value={fmtNum(profileQ.data.money ?? profileQ.data.coins)}
                    accent="blurple"
                  />
                  <StatTile
                    label="Inscription"
                    value={fmtDate(
                      (profileQ.data as { firstSeen?: number }).firstSeen ??
                        profileQ.data.firstJoin ??
                        profileQ.data.createdAt,
                    )}
                  />
                </div>
              )}
            </ToolCard>

            <ToolCard>
              <SectionTitle>Ventes en cours</SectionTitle>
              {salesQ.isLoading && <LoadingBlock />}
              {salesQ.data && salesQ.data.open.length === 0 && (
                <p className="text-muted-foreground/70 text-xs mt-2">
                  Aucune vente active enregistrée.
                </p>
              )}
              {salesQ.data && salesQ.data.open.length > 0 && (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-sm mt-2 min-w-[480px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                        <th className="py-2">Item</th>
                        <th className="py-2 text-right">Qté</th>
                        <th className="py-2 text-right">Prix u.</th>
                        <th className="py-2 text-right">Listé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesQ.data.open.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="py-2 text-foreground/80 font-mono">{r.item_name}</td>
                          <td className="py-2 text-right text-white">{r.quantity}</td>
                          <td className="py-2 text-right text-primary font-bold">
                            {fmtNum(Number(r.price))}
                          </td>
                          <td className="py-2 text-right text-muted-foreground text-xs">
                            {fmtDate(r.listed_at ?? r.first_seen_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ToolCard>

            <ToolCard>
              <SectionTitle>Ventes passées (snapshots BDD)</SectionTitle>
              {salesQ.data && salesQ.data.sold.length === 0 && (
                <p className="text-muted-foreground/70 text-xs mt-2">
                  Aucun historique pour l'instant — la sync auto tourne toutes les 10 min.
                </p>
              )}
              {salesQ.data && salesQ.data.sold.length > 0 && (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-sm mt-2 min-w-[480px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                        <th className="py-2">Item</th>
                        <th className="py-2 text-right">Qté</th>
                        <th className="py-2 text-right">Prix u.</th>
                        <th className="py-2 text-right">Vendu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesQ.data.sold.slice(0, 50).map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="py-2 text-foreground/80 font-mono">{r.item_name}</td>
                          <td className="py-2 text-right text-white">{r.quantity}</td>
                          <td className="py-2 text-right text-primary font-bold">
                            {fmtNum(Number(r.price))}
                          </td>
                          <td className="py-2 text-right text-muted-foreground text-xs">
                            {fmtDate(r.sold_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ToolCard>

            <ToolCard>
              <SectionTitle>Clicker</SectionTitle>
              {palaQ.isLoading && <LoadingBlock />}
              {palaQ.error && <ErrorBlock message={(palaQ.error as Error).message} />}
              {palaQ.data && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <StatTile
                    label="RPS"
                    value={fmtNum(palaQ.data.clicker?.rps ?? palaQ.data.rps)}
                    accent="pink"
                  />
                  <StatTile
                    label="Bâtiments"
                    value={
                      (palaQ.data as { buildings?: unknown[] }).buildings?.length ??
                      palaQ.data.clicker?.buildings?.length ??
                      0
                    }
                    accent="blurple"
                  />
                </div>
              )}
            </ToolCard>

            <ToolCard>
              <SectionTitle>Métiers</SectionTitle>
              {jobsQ.isLoading && <LoadingBlock />}
              {jobs.length > 0 && (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-sm mt-2 min-w-[360px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
                        <th className="py-2">Métier</th>
                        <th className="py-2">Niveau</th>
                        <th className="py-2">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-2 text-foreground/80 capitalize">{j.name}</td>
                          <td className="py-2 text-white font-bold">{j.level}</td>
                          <td className="py-2 text-muted-foreground">
                            {fmtNum(j.experience ?? j.xp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {jobs.length === 0 && !jobsQ.isLoading && (
                <p className="text-muted-foreground/70 text-xs mt-2">Aucun métier.</p>
              )}
            </ToolCard>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10px] uppercase tracking-[0.3em] text-primary mb-1"
      style={{ fontFamily: "'Space Mono'" }}
    >
      // {children}
    </h2>
  );
}

function fmtNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR");
}
function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(typeof v === "number" && v < 1e12 ? v * 1000 : (v as string | number));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}
function fmtPlaytime(minutes: unknown): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
