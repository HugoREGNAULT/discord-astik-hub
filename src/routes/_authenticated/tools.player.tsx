import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

  const uuidQ = useQuery({
    queryKey: ["mojang", username],
    queryFn: () => resolveUuid(username!),
    enabled: !!username,
    retry: false,
    staleTime: 60_000,
  });

  const uuid = uuidQ.data?.id;

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

      {uuidQ.isFetching && <LoadingBlock label="Résolution UUID…" />}
      {uuidQ.error && <ErrorBlock message={(uuidQ.error as Error).message} />}

      {uuid && (
        <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
          <ToolCard className="flex flex-col items-center text-center">
            <img
              src={avatarUrl(uuid, 128)}
              alt={uuidQ.data?.name}
              className="w-32 h-32 border border-zinc-800 bg-zinc-950"
            />
            <div
              className="mt-3 text-sm font-bold uppercase tracking-tight text-white"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {uuidQ.data?.name}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 break-all"
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
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
                      <th className="py-2">Métier</th>
                      <th className="py-2">Niveau</th>
                      <th className="py-2">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j, i) => (
                      <tr key={i} className="border-b border-zinc-900 last:border-0">
                        <td className="py-2 text-zinc-300 capitalize">{j.name}</td>
                        <td className="py-2 text-white font-bold">{j.level}</td>
                        <td className="py-2 text-zinc-400">{fmtNum(j.experience ?? j.xp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {jobs.length === 0 && !jobsQ.isLoading && (
                <p className="text-zinc-600 text-xs mt-2">Aucun métier.</p>
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
      className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-1"
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
