import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes } from "lucide-react";
import { getMemberMcStats } from "@/lib/data/mc-link.functions";

export function McStatsCard({ discordId }: { discordId: string }) {
  const fn = useServerFn(getMemberMcStats);
  const { data } = useQuery({
    queryKey: ["mc-stats", discordId],
    queryFn: () => fn({ data: { discordId } }),
    staleTime: 60_000,
  });

  if (!data || !data.uuid) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Boxes className="size-4 text-primary" /> Stats Paladium
          <span className="ml-auto text-[10px] text-muted-foreground font-normal">
            {data.history_count} snapshot{data.history_count > 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!data.latest && (
          <p className="text-muted-foreground text-xs">
            Aucun snapshot encore importé.
          </p>
        )}
        {data.latest && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-muted-foreground">Argent</div>
                <div className="font-mono">
                  {data.latest.money != null
                    ? data.latest.money.toLocaleString("fr-FR")
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">
                  Faction in-game
                </div>
                <div>{data.latest.faction_ingame ?? "—"}</div>
              </div>
            </div>
            {data.latest.jobs.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Jobs</div>
                <div className="flex flex-wrap gap-1">
                  {data.latest.jobs.slice(0, 12).map((j) => (
                    <span
                      key={j.name}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-muted"
                    >
                      {j.name} · {j.level}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              Snapshot du {new Date(data.latest.snapshot_at).toLocaleString()}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Sources Paladium brutes
              </summary>
              <pre className="mt-1 p-2 bg-muted/40 rounded overflow-auto max-h-64 text-[10px]">
                {JSON.stringify(JSON.parse(data.latest.raw_json), null, 2)}
              </pre>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
