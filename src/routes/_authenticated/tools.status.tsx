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

type StatusPayload = {
  java?: {
    global?: { status?: string; players?: number };
    factions?: Record<string, string>;
  };
  launcher?: { status?: string };
  anarchy?: { status?: string; players?: number };
};

function isOnlineStatus(s: string | undefined): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  return v === "online" || v === "running" || v === "whitelist";
}

function statusColor(s: string | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (v === "online" || v === "running")
    return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]";
  if (v === "whitelist") return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]";
  if (v === "offline") return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]";
  return "bg-zinc-600";
}

function StatusPage() {
  const q = useQuery({
    queryKey: ["pala-status"],
    queryFn: () => PaladiumApi.getStatus() as Promise<StatusPayload>,
    refetchInterval: 60_000,
    retry: false,
  });

  const data = q.data;

  return (
    <div className="max-w-6xl space-y-5">
      <ToolHeader
        code="// tools.status"
        title="Statut Serveurs"
        description="Auto-refresh toutes les 60 secondes."
      />
      {!hasPaladiumKey() && <MissingKeyBanner />}
      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BigTile
              name="Java — Global"
              status={data.java?.global?.status}
              detail={`${data.java?.global?.players ?? 0} joueurs`}
            />
            <BigTile
              name="Anarchy"
              status={data.anarchy?.status}
              detail={`${data.anarchy?.players ?? 0} joueurs`}
            />
            <BigTile name="Launcher" status={data.launcher?.status} detail="" />
          </div>

          <div>
            <h2
              className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-2 mt-6"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // serveurs factions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(data.java?.factions ?? {}).map(([name, st]) => (
                <ToolCard key={name}>
                  <div className="flex items-center justify-between">
                    <div
                      className="text-sm font-bold uppercase tracking-tight text-white"
                      style={{ fontFamily: "'Space Grotesk'" }}
                    >
                      {name}
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${statusColor(st)}`} />
                  </div>
                  <div
                    className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    {st}
                  </div>
                </ToolCard>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BigTile({ name, status, detail }: { name: string; status?: string; detail: string }) {
  const online = isOnlineStatus(status);
  return (
    <ToolCard>
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // service
          </div>
          <div
            className="text-base font-bold uppercase tracking-tight text-white"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {name}
          </div>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full ${statusColor(status)}`} />
      </div>
      <div className="mt-3 text-2xl font-bold text-white">
        {online ? "ONLINE" : (status ?? "—").toUpperCase()}
      </div>
      {detail && <div className="text-xs text-zinc-500 mt-1">{detail}</div>}
    </ToolCard>
  );
}
