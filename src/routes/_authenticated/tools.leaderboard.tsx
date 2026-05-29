import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, asArray, hasPaladiumKey, type LeaderboardEntry } from "@/lib/paladium/api";
import { resolveMojangUuid, resolveUuidsToNames } from "@/lib/paladium/mojang.functions";

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
  { id: "money", label: "Argent", kind: "standard" },
  { id: "clicker", label: "Clicker", kind: "standard" },
  { id: "boss", label: "Boss", kind: "standard" },
  { id: "job.miner", label: "Mineur", kind: "standard" },
  { id: "job.farmer", label: "Fermier", kind: "standard" },
  { id: "job.hunter", label: "Chasseur", kind: "standard" },
  { id: "job.alchemist", label: "Alchimiste", kind: "standard" },
  { id: "koth", label: "KOTH", kind: "standard" },
  { id: "end", label: "End", kind: "standard" },
  { id: "chorus", label: "Chorus", kind: "standard" },
  { id: "egghunt", label: "Egg Hunt", kind: "standard" },
  { id: "alliance", label: "Alliance", kind: "standard" },
  { id: "trixium.players", label: "Trixium · Joueurs", kind: "trixium-players" },
  { id: "trixium.factions", label: "Trixium · Factions", kind: "trixium-factions" },
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LeaderboardPage() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]["id"]>("money");
  const [search, setSearch] = useState("");
  const meta = CATEGORIES.find((c) => c.id === cat)!;
  const q = useQuery({
    queryKey: ["pala-lb", cat],
    queryFn: () => {
      if (meta.kind === "trixium-players") return PaladiumApi.getTrixiumPlayers();
      if (meta.kind === "trixium-factions") return PaladiumApi.getTrixiumFactions();
      return PaladiumApi.getLeaderboard(cat);
    },
    retry: false,
    staleTime: 60_000,
  });
  const rows = asArray<LeaderboardEntry>(q.data ?? null);

  // Collect UUIDs that came back as their own username (unresolved).
  const uuidsToResolve = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const username = (r.username ?? "") as string;
      const uuid = (r as { uuid?: string }).uuid;
      if (uuid && username && UUID_RE.test(username)) set.add(uuid);
    }
    return Array.from(set);
  }, [rows]);

  const namesQ = useQuery({
    queryKey: ["mojang-names", uuidsToResolve.sort().join(",")],
    queryFn: () => resolveUuidsToNames({ data: { uuids: uuidsToResolve } }),
    enabled: uuidsToResolve.length > 0,
    retry: false,
    staleTime: 10 * 60_000,
  });

  const nameMap = namesQ.data ?? {};

  // Resolve search input → uuid (if it looks like a pseudo, not a uuid).
  const trimmedSearch = search.trim();
  const searchIsUuid = UUID_RE.test(trimmedSearch);
  const searchQ = useQuery({
    queryKey: ["mojang-search", trimmedSearch.toLowerCase()],
    queryFn: () => resolveMojangUuid({ data: { username: trimmedSearch } }),
    enabled: trimmedSearch.length >= 2 && !searchIsUuid && /^[A-Za-z0-9_]+$/.test(trimmedSearch),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const searchUuid = searchIsUuid ? trimmedSearch.toLowerCase() : searchQ.data?.id ?? null;
  const searchName = searchQ.data?.name ?? null;

  const matchesRow = (r: LeaderboardEntry) => {
    if (!trimmedSearch) return true;
    const uuid = ((r as { uuid?: string }).uuid ?? "").toLowerCase();
    const raw = ((r.username ?? "") as string).toLowerCase();
    const faction = (((r as { factionName?: string }).factionName ?? r.faction ?? "") as string).toLowerCase();
    const resolved = uuid && UUID_RE.test(raw) ? (nameMap[(r as { uuid?: string }).uuid!] ?? "").toLowerCase() : "";
    const s = trimmedSearch.toLowerCase();
    if (searchUuid && uuid === searchUuid) return true;
    return raw.includes(s) || resolved.includes(s) || faction.includes(s);
  };
  const filtered = trimmedSearch ? rows.filter(matchesRow) : rows;


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

      <ToolCard>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un pseudo, UUID ou faction…"
            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/60"
            style={{ fontFamily: "'Space Mono'" }}
          />
          {trimmedSearch && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] border border-zinc-800 text-zinc-400 hover:text-pink-400"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Effacer
            </button>
          )}
        </div>
        {trimmedSearch && (
          <div className="mt-2 text-[11px] text-zinc-500" style={{ fontFamily: "'Space Mono'" }}>
            {searchQ.isFetching && "Résolution Mojang…"}
            {!searchQ.isFetching && searchUuid && (
              <>
                Pseudo résolu :{" "}
                <span className="text-pink-400">{searchName ?? trimmedSearch}</span>{" "}
                <span className="text-zinc-600">· {searchUuid}</span>
              </>
            )}
            {!searchQ.isFetching && !searchUuid && !searchIsUuid && searchQ.error && (
              <span className="text-amber-400">Pseudo introuvable côté Mojang — recherche en texte brut.</span>
            )}
            <span className="ml-2 text-zinc-600">· {filtered.length} résultat(s)</span>
          </div>
        )}
      </ToolCard>

      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

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
              {filtered.map((r, i) => {
                const uuid = (r as { uuid?: string }).uuid;
                const raw = (r.username ?? "") as string;
                const resolved = uuid && UUID_RE.test(raw) ? nameMap[uuid] : null;
                const display = resolved ?? (UUID_RE.test(raw) ? "—" : raw || "—");
                const highlight = !!searchUuid && (uuid ?? "").toLowerCase() === searchUuid;
                return (
                  <tr
                    key={i}
                    className={`border-b border-zinc-900 last:border-0 ${
                      highlight ? "bg-pink-500/10" : "hover:bg-zinc-900/50"
                    }`}
                  >
                    <td className="py-2 px-4 text-pink-400 font-bold">
                      {(r as { position?: number }).position ?? r.rank ?? i + 1}
                    </td>
                    <td className="py-2 px-4 text-zinc-200">{display}</td>
                    <td className="py-2 px-4 text-zinc-400">
                      {(r as { factionName?: string }).factionName ?? r.faction ?? "—"}
                    </td>
                    <td className="py-2 px-4 text-right text-white font-bold">{fmtNum(r.value)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-zinc-500 text-xs">
                    Aucun joueur ne correspond à « {trimmedSearch} » dans cette catégorie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ToolCard>
      )}

    </div>
  );
}

function fmtNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return Math.round(n * 100) / 100 >= 1
    ? Math.round(n).toLocaleString("fr-FR")
    : n.toFixed(2);
}
