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
import { PaladiumApi, hasPaladiumKey } from "@/lib/paladium/api";

export const Route = createFileRoute("/_authenticated/tools/faction")({
  head: () => ({
    meta: [
      { title: "Profil faction · Outils PunkAstik" },
      { name: "description", content: "Détails d'une faction Paladium." },
    ],
  }),
  component: FactionLookup,
});

function FactionLookup() {
  const [input, setInput] = useState("");
  const [name, setName] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["faction", name],
    queryFn: () => PaladiumApi.getFaction(name!),
    enabled: !!name,
    retry: false,
  });

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.faction"
        title="Profil Faction"
        description="Tape le nom d'une faction Paladium pour voir ses membres, alliances et statistiques."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      <ToolCard>
        <div className="space-y-3">
          <SearchInput
            value={input}
            onChange={setInput}
            onSubmit={() => setName(input.trim() || null)}
            placeholder="Nom de faction…"
          />
          <button
            type="button"
            onClick={() => {
              setInput("PunkAstik");
              setName("PunkAstik");
            }}
            className="text-[10px] uppercase tracking-[0.3em] text-pink-500 hover:text-pink-400"
            style={{ fontFamily: "'Space Mono'" }}
          >
            → voir PunkAstik
          </button>
        </div>
      </ToolCard>

      {q.isFetching && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      {q.data && (
        <div className="space-y-5">
          <ToolCard>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2
                className="text-2xl font-bold uppercase tracking-tight text-white"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {q.data.name}
              </h2>
              {typeof q.data.level === "number" && (
                <span
                  className="text-[10px] uppercase tracking-[0.3em] text-pink-500"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  // niveau {q.data.level}
                </span>
              )}
            </div>
            {q.data.description && (
              <p className="text-zinc-400 text-sm mt-2">{q.data.description}</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <StatTile label="Membres" value={q.data.members?.length ?? "—"} accent="pink" />
              <StatTile label="Alliés" value={q.data.allies?.length ?? "—"} />
              <StatTile label="Ennemis" value={q.data.enemies?.length ?? "—"} />
              <StatTile
                label="Puissance"
                value={typeof q.data.power === "number" ? q.data.power : "—"}
                accent="blurple"
              />
            </div>
          </ToolCard>

          {q.data.members && q.data.members.length > 0 && (
            <ToolCard>
              <h3
                className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-3"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // membres
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.data.members.map((m) => (
                  <div
                    key={m.uuid}
                    className="flex items-center justify-between border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-200 truncate">{m.username}</span>
                    {m.role && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        {m.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ToolCard>
          )}
        </div>
      )}
    </div>
  );
}
