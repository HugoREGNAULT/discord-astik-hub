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
            className="text-[10px] uppercase tracking-[0.3em] text-primary hover:text-primary"
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
              {q.data.level && (
                <span
                  className="text-[10px] uppercase tracking-[0.3em] text-primary"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  // niveau {q.data.level.level}
                </span>
              )}
            </div>
            {q.data.description && (
              <p className="text-muted-foreground text-sm mt-2">{q.data.description}</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <StatTile label="Membres" value={q.data.players?.length ?? "—"} accent="pink" />
              <StatTile label="XP" value={q.data.level?.xp ?? "—"} />
              <StatTile label="Alliance" value={q.data.alliance ?? "—"} />
              <StatTile label="Accès" value={q.data.access ?? "—"} accent="blurple" />
            </div>
          </ToolCard>

          {q.data.players && q.data.players.length > 0 && (
            <ToolCard>
              <h3
                className="text-[10px] uppercase tracking-[0.3em] text-primary mb-3"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // membres ({q.data.players.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.data.players.map((m) => (
                  <div
                    key={m.uuid}
                    className="flex items-center justify-between border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="text-foreground truncate">{m.username}</span>
                    {m.group && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {m.group}
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
