import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, asArray, hasPaladiumKey, type LeaderboardEntry } from "@/lib/paladium/api";

export const Route = createFileRoute("/_authenticated/tools/leaderboard")({
  head: () => ({
    meta: [
      { title: "Classements · Outils PunkAstik" },
      { name: "description", content: "Top joueurs Paladium." },
    ],
  }),
  component: LeaderboardPage,
});

const CATEGORIES = [
const CATEGORIES = [
  { id: "money", label: "Argent" },
  { id: "clicker", label: "Clicker" },
  { id: "boss", label: "Boss" },
  { id: "job-miner", label: "Mineur" },
  { id: "job-farmer", label: "Fermier" },
  { id: "job-hunter", label: "Chasseur" },
  { id: "job-alchemist", label: "Alchimiste" },
  { id: "koth", label: "KOTH" },
  { id: "end", label: "End" },
  { id: "chorus", label: "Chorus" },
] as const;

function LeaderboardPage() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]["id"]>("money");
  const q = useQuery({
    queryKey: ["pala-lb", cat],
    queryFn: () => PaladiumApi.getLeaderboard(cat),
    retry: false,
    staleTime: 60_000,
  });
  const rows = asArray<LeaderboardEntry>(q.data ?? null);

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.leaderboard"
        title="Classements"
        description="Top des joueurs Paladium selon différentes catégories."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border ${
                cat === c.id
                  ? "border-pink-500 text-white bg-pink-500/10"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
              }`}
              style={{ fontFamily: "'Space Mono'" }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </ToolCard>

      {q.isLoading && <LoadingBlock />}
      {q.error && (
        <ErrorBlock
          message={(q.error as Error).message}
          hint="L'endpoint leaderboard peut différer selon la catégorie."
        />
      )}

      {rows.length > 0 && (
        <ToolCard className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800">
                <th className="py-2 px-4">#</th>
                <th className="py-2 px-4">Pseudo</th>
                <th className="py-2 px-4">Faction</th>
                <th className="py-2 px-4 text-right">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/50">
                  <td className="py-2 px-4 text-pink-400 font-bold">{r.rank ?? i + 1}</td>
                  <td className="py-2 px-4 text-zinc-200">{r.username ?? "—"}</td>
                  <td className="py-2 px-4 text-zinc-400">{r.faction ?? "—"}</td>
                  <td className="py-2 px-4 text-right text-white font-bold">{fmtNum(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ToolCard>
      )}
    </div>
  );
}

function fmtNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("fr-FR");
}
