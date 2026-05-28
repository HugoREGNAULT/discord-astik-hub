import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paginator, usePagedSlice } from "@/components/Paginator";
import { listLogs, listLogActions } from "@/lib/data/logs.functions";
import { FileText, RotateCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs · PunkAstik" }] }),
  component: () => (
    <Guard perm="admin.access">
      <LogsPage />
    </Guard>
  ),
});

const PER_PAGE = 25;

function LogsPage() {
  const listFn = useServerFn(listLogs);
  const actionsFn = useServerFn(listLogActions);

  const [action, setAction] = useState<string>("all");
  const [actor, setActor] = useState("");
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [sinceDays, setSinceDays] = useState(30);
  const [page, setPage] = useState(1);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["logs", action, actor, level, sinceDays],
    queryFn: () =>
      listFn({
        data: {
          action: action === "all" ? undefined : action,
          actorDiscordId: actor.trim() || undefined,
          level,
          sinceDays,
          limit: 500,
        },
      }),
  });

  const { data: actionsData } = useQuery({
    queryKey: ["log-actions"],
    queryFn: () => actionsFn(),
  });

  const logs = data?.logs ?? [];
  const pageCount = Math.max(1, Math.ceil(logs.length / PER_PAGE));
  const paged = useMemo(() => usePagedSlice(logs, page, PER_PAGE), [logs, page]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Logs système
          </h1>
          <p className="text-sm text-muted-foreground">
            Toutes les actions sensibles (admin, dons, points, candidatures…).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RotateCw className={`size-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <Card>
        <CardContent className="py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Action</label>
            <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Toutes</SelectItem>
                {(actionsData?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Niveau</label>
            <Select value={level} onValueChange={(v) => { setLevel(v as typeof level); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Acteur (Discord ID)</label>
            <Input
              value={actor}
              onChange={(e) => { setActor(e.target.value); setPage(1); }}
              placeholder="ID Discord"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Période (jours)</label>
            <Select
              value={String(sinceDays)}
              onValueChange={(v) => { setSinceDays(Number(v)); setPage(1); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24h</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
                <SelectItem value="365">1 an</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isFetching && logs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Chargement…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              Aucun log pour ces filtres.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {paged.map((l) => (
                <li key={l.id} className="p-3 text-sm">
                  <div className="flex items-start gap-3 flex-wrap">
                    <LevelBadge level={l.level} />
                    <code className="text-xs font-mono">{l.action}</code>
                    {l.actor_discord_id && (
                      <span className="text-xs text-muted-foreground font-mono">
                        @{l.actor_discord_id}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(l.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  {l.payload && Object.keys(l.payload as object).length > 0 && (
                    <pre className="text-[10px] font-mono mt-2 p-2 bg-muted rounded overflow-x-auto">
                      {JSON.stringify(l.payload, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {logs.length} log{logs.length > 1 ? "s" : ""} ·{" "}
          {pageCount > 1 && `page ${page} / ${pageCount}`}
        </span>
        <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const cls =
    level === "error"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : level === "warn"
        ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
        : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cls}>
      {level}
    </Badge>
  );
}
