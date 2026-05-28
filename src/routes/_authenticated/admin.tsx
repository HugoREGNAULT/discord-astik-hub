import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOverview } from "@/lib/data/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · PunkAstik" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fn = useServerFn(getAdminOverview);
  const { data } = useQuery({ queryKey: ["admin"], queryFn: () => fn(), refetchInterval: 30_000 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Membres" value={data?.profilesCount ?? "—"} />
        <Stat label="Paniers actifs" value={data?.activeCarts ?? "—"} />
        <Stat label="Discord API" value={data?.discord.ok ? `OK ${data.discord.latencyMs}ms` : "DOWN"} ok={data?.discord.ok} />
        <Stat label="Dernier refresh rôles" value={data?.lastRoleRefresh ? new Date(data.lastRoleRefresh).toLocaleTimeString() : "—"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Erreurs récentes</CardTitle></CardHeader>
        <CardContent>
          <LogList items={data?.recentErrors ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Logs récents</CardTitle></CardHeader>
        <CardContent>
          <LogList items={data?.recentLogs ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: any; ok?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${ok === false ? "text-destructive" : ok ? "text-success" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function LogList({ items }: { items: any[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Aucun log.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {items.map((l) => (
        <li key={l.id} className="py-2 flex items-start gap-2">
          <Badge variant={l.level === "error" ? "destructive" : l.level === "warn" ? "secondary" : "default"}>{l.level}</Badge>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()} · {l.actor_discord_id ?? "system"}</div>
            <div className="font-mono text-xs truncate">{l.action} {l.payload && Object.keys(l.payload).length > 0 ? JSON.stringify(l.payload) : ""}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
