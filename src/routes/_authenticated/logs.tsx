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
import { Download, FileText, RotateCw } from "lucide-react";
import { RowListSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs · PunkAstik" }] }),
  component: () => (
    <Guard perm="admin.access">
      <LogsPage />
    </Guard>
  ),
});

const PER_PAGE = 25;

function toIsoStart(d: string) {
  return d ? new Date(`${d}T00:00:00`).toISOString() : undefined;
}
function toIsoEnd(d: string) {
  return d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = ["created_at", "level", "action", "actor_discord_id", "payload"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function LogsPage() {
  const listFn = useServerFn(listLogs);
  const actionsFn = useServerFn(listLogActions);

  const [action, setAction] = useState<string>("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [sinceDays, setSinceDays] = useState(30);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const useRange = Boolean(dateFrom || dateTo);

  const queryInput = useMemo(
    () => ({
      action: action === "all" ? undefined : action,
      memberQuery: memberQuery.trim() || undefined,
      level,
      sinceDays: useRange ? 365 : sinceDays,
      dateFrom: toIsoStart(dateFrom),
      dateTo: toIsoEnd(dateTo),
      limit: 1000,
    }),
    [action, memberQuery, level, sinceDays, dateFrom, dateTo, useRange],
  );

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["logs", queryInput],
    queryFn: () => listFn({ data: queryInput }),
  });

  const { data: actionsData } = useQuery({
    queryKey: ["log-actions"],
    queryFn: () => actionsFn(),
  });

  const logs = data?.logs ?? [];
  const pageCount = Math.max(1, Math.ceil(logs.length / PER_PAGE));
  const paged = usePagedSlice(logs, page, PER_PAGE);

  const resetFilters = () => {
    setAction("all");
    setMemberQuery("");
    setLevel("all");
    setSinceDays(30);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`logs-${stamp}.csv`, logs as Array<Record<string, unknown>>);
  };

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={logs.length === 0}
          >
            <Download className="size-4 mr-1" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RotateCw className={`size-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <label className="text-xs text-muted-foreground">Membre (ID, pseudo Discord ou IG)</label>
            <Input
              value={memberQuery}
              onChange={(e) => { setMemberQuery(e.target.value); setPage(1); }}
              placeholder="ex: 1234567890 ou astik"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Période rapide</label>
            <Select
              value={String(sinceDays)}
              onValueChange={(v) => { setSinceDays(Number(v)); setDateFrom(""); setDateTo(""); setPage(1); }}
              disabled={useRange}
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
          <div>
            <label className="text-xs text-muted-foreground">Du</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Au</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isFetching && logs.length === 0 ? (
            <RowListSkeleton count={10} />
          ) : logs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={FileText}
                title="Aucun log"
                description="Aucune entrée ne correspond à ces filtres."
              />
            </div>
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
