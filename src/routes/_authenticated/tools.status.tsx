import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ToolHeader,
  ToolCard,
  LoadingBlock,
  ErrorBlock,
  MissingKeyBanner,
} from "@/components/tools/ToolsUi";
import { PaladiumApi, hasPaladiumKey } from "@/lib/paladium/api";

export const Route = createFileRoute("/_authenticated/tools/status")({
  head: () => ({
    meta: [
      { title: "Statut serveurs · Outils PunkAstik" },
      { name: "description", content: "État live des serveurs Paladium." },
    ],
  }),
  component: StatusPage,
});

type ServerRow = { name: string; online: number; max?: number; status?: string };

function StatusPage() {
  const q = useQuery({
    queryKey: ["pala-status"],
    queryFn: () => PaladiumApi.getStatus(),
    refetchInterval: 60_000,
    retry: false,
  });

  const rows = extractServers(q.data);

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.status"
        title="Statut Serveurs"
        description="Auto-refresh toutes les 60 secondes."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}

      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((s) => {
            const online = (s.status?.toLowerCase() ?? "") !== "offline" && s.online >= 0;
            return (
              <ToolCard key={s.name}>
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
                      style={{ fontFamily: "'Space Mono'" }}
                    >
                      // serveur
                    </div>
                    <div
                      className="text-base font-bold uppercase tracking-tight text-white"
                      style={{ fontFamily: "'Space Grotesk'" }}
                    >
                      {s.name}
                    </div>
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      online
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                        : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                    }`}
                  />
                </div>
                <div className="mt-3 text-2xl font-bold text-white">
                  {s.online}
                  {typeof s.max === "number" && (
                    <span className="text-sm text-zinc-500 ml-1">/ {s.max}</span>
                  )}
                  <span className="text-xs text-zinc-500 ml-2">joueurs</span>
                </div>
              </ToolCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function extractServers(data: unknown): ServerRow[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.servers)) return d.servers as ServerRow[];
  // Object map { paladium: {online, max}, anarchie: {...} }
  const rows: ServerRow[] = [];
  for (const [name, val] of Object.entries(d)) {
    if (val && typeof val === "object" && "online" in (val as object)) {
      const v = val as { online: number; max?: number; status?: string };
      rows.push({ name, online: v.online, max: v.max, status: v.status });
    }
  }
  return rows;
}
