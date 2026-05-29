import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  StatTile,
  SearchInput,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, hasPaladiumKey, resolveUuid } from "@/lib/paladium/api";
import { CLICKER_CATALOG, nextCost } from "@/lib/paladium/clicker-catalog";

export const Route = createFileRoute("/_authenticated/tools/clicker")({
  head: () => ({
    meta: [
      { title: "PalaClicker Optimizer · Outils PunkAstik" },
      {
        name: "description",
        content:
          "Recommande le prochain achat le plus rentable en RPS pour maximiser tes ClicCoins.",
      },
    ],
  }),
  component: ClickerOptimizer,
});

type Suggestion = {
  name: string;
  cost: number;
  gainRps: number;
  ratio: number;
  waitSeconds: number;
};

const TICK_SECONDS = 1.33;

function ClickerOptimizer() {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState<string | null>(null);

  const uuidQ = useQuery({
    queryKey: ["mojang", username],
    queryFn: () => resolveUuid(username!),
    enabled: !!username,
    retry: false,
  });
  const uuid = uuidQ.data?.id;

  const palaQ = useQuery({
    queryKey: ["pala-clicker", uuid],
    queryFn: () => PaladiumApi.getPaladiumProfile(uuid!),
    enabled: !!uuid,
    retry: false,
  });

  const { rps, coins, suggestions } = useMemo(() => {
    const clicker = palaQ.data?.clicker;
    const rps = Number(clicker?.rps ?? palaQ.data?.rps ?? 0);
    const coins = Number(clicker?.coins ?? palaQ.data?.cliccoins ?? 0);

    const list: Suggestion[] = [];

    // From API buildings if structured
    const apiBuildings = clicker?.buildings ?? [];
    for (const b of apiBuildings) {
      const cost = Number(b.cost ?? b.baseCost ?? 0);
      const gain = Number(b.baseRps ?? b.rps ?? 0);
      if (cost > 0 && gain > 0) {
        list.push({
          name: b.name,
          cost,
          gainRps: gain,
          ratio: gain / cost,
          waitSeconds: waitFor(cost, rps),
        });
      }
    }
    for (const u of clicker?.upgrades ?? []) {
      if (u.bought) continue;
      const cost = Number(u.cost ?? 0);
      const gain = Number(u.gainRps ?? 0);
      if (cost > 0 && gain > 0) {
        list.push({
          name: `↑ ${u.name}`,
          cost,
          gainRps: gain,
          ratio: gain / cost,
          waitSeconds: waitFor(cost, rps),
        });
      }
    }

    // Fallback to static catalog if nothing useful from API
    if (list.length === 0 && uuid) {
      for (const entry of CLICKER_CATALOG) {
        const owned = apiBuildings.find((b) => b.name.toLowerCase() === entry.label.toLowerCase())
          ?.amount ?? 0;
        const cost = nextCost(entry, owned);
        list.push({
          name: entry.label,
          cost,
          gainRps: entry.baseRps,
          ratio: entry.baseRps / cost,
          waitSeconds: waitFor(cost, rps),
        });
      }
    }

    list.sort((a, b) => b.ratio - a.ratio);
    return { rps, coins, suggestions: list.slice(0, 10) };
  }, [palaQ.data, uuid]);

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.clicker"
        title="PalaClicker Optimizer"
        description="Calcule le meilleur ratio gain RPS / coût pour ton prochain achat. Temps d'attente basé sur ton RPS actuel et le tick de 1,33 s."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <SearchInput
          value={input}
          onChange={setInput}
          onSubmit={() => setUsername(input.trim() || null)}
          placeholder="Pseudo Minecraft…"
          buttonLabel="Analyser"
        />
      </ToolCard>

      {uuidQ.isFetching && <LoadingBlock label="Résolution UUID…" />}
      {uuidQ.error && <ErrorBlock message={(uuidQ.error as Error).message} />}
      {palaQ.isLoading && <LoadingBlock />}
      {palaQ.error && <ErrorBlock message={(palaQ.error as Error).message} />}

      {palaQ.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatTile label="ClicCoins" value={fmtNum(coins)} accent="pink" />
            <StatTile label="RPS actuel" value={fmtNum(rps)} accent="blurple" />
            <StatTile
              label="Tick"
              value={`${TICK_SECONDS}s`}
            />
          </div>

          {suggestions.length > 0 && (
            <>
              <ToolCard>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  <h2
                    className="text-[10px] uppercase tracking-[0.3em] text-pink-500"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    // meilleur achat
                  </h2>
                </div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <div
                    className="text-2xl font-bold uppercase tracking-tight text-white"
                    style={{ fontFamily: "'Space Grotesk'" }}
                  >
                    {suggestions[0].name}
                  </div>
                  <div className="text-zinc-400 text-sm">
                    coût <span className="text-pink-400">{fmtNum(suggestions[0].cost)}</span>{" "}
                    · gain{" "}
                    <span className="text-emerald-400">
                      +{fmtNum(suggestions[0].gainRps)} rps
                    </span>{" "}
                    · attente{" "}
                    <span className="text-[#5865F2]">
                      {fmtDuration(suggestions[0].waitSeconds)}
                    </span>
                  </div>
                </div>
              </ToolCard>

              <ToolCard className="!p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 px-4">#</th>
                      <th className="py-2 px-4">Achat</th>
                      <th className="py-2 px-4 text-right">Coût</th>
                      <th className="py-2 px-4 text-right">Gain RPS</th>
                      <th className="py-2 px-4 text-right">Ratio</th>
                      <th className="py-2 px-4 text-right">Attente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s, i) => (
                      <tr
                        key={i}
                        className={`border-b border-zinc-900 last:border-0 ${
                          i === 0 ? "bg-pink-500/5" : "hover:bg-zinc-900/50"
                        }`}
                      >
                        <td className="py-2 px-4 text-pink-400 font-bold">{i + 1}</td>
                        <td className="py-2 px-4 text-zinc-200">{s.name}</td>
                        <td className="py-2 px-4 text-right text-zinc-300">
                          {fmtNum(s.cost)}
                        </td>
                        <td className="py-2 px-4 text-right text-emerald-400">
                          +{fmtNum(s.gainRps)}
                        </td>
                        <td className="py-2 px-4 text-right text-white">
                          {s.ratio.toExponential(2)}
                        </td>
                        <td className="py-2 px-4 text-right text-[#5865F2]">
                          {fmtDuration(s.waitSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ToolCard>
            </>
          )}
        </>
      )}
    </div>
  );
}

function waitFor(cost: number, rps: number): number {
  if (rps <= 0) return Infinity;
  return cost / (rps / TICK_SECONDS);
}

function fmtNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR");
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "∞";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}j ${Math.floor((s % 86400) / 3600)}h`;
}
