import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuditOverview } from "@/lib/data/audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit · Admin · PunkAstik" }] }),
  component: () => (
    <Guard perm="admin.access">
      <AuditPage />
    </Guard>
  ),
});

function AuditPage() {
  const fn = useServerFn(getAuditOverview);
  const { data, isLoading } = useQuery({ queryKey: ["audit-overview"], queryFn: () => fn() });
  const lastCheck = data?.lastCheck;
  const sensitive = data?.sensitive ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        code="// audit"
        title="Audit & intégrité"
        description="État de la chaîne d'audit logs et dernières actions sensibles (lecture seule)."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {lastCheck?.ok ? (
              <ShieldCheck className="size-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="size-4 text-destructive" />
            )}
            Dernière vérification d'intégrité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isLoading && <p className="text-muted-foreground">Chargement…</p>}
          {!isLoading && !lastCheck && (
            <p className="text-muted-foreground">
              Aucune vérification effectuée pour l'instant — le job planifié n'a pas encore tourné.
            </p>
          )}
          {lastCheck && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={lastCheck.ok ? "default" : "destructive"}>
                  {lastCheck.ok ? "OK" : "CASSÉ"}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(lastCheck.checked_at).toLocaleString()}
                </span>
              </div>
              {!lastCheck.ok && lastCheck.broken_at_seq !== null && (
                <p>
                  Cassure détectée à l'entrée{" "}
                  <code className="font-mono">seq={lastCheck.broken_at_seq}</code>.
                </p>
              )}
              {lastCheck.detail && (
                <p className="text-xs text-muted-foreground font-mono">{lastCheck.detail}</p>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
            <strong>Limite honnête :</strong> ce mécanisme détecte les altérations non coordonnées
            de l'historique (édition accidentelle, outil tiers, fuite). Il ne protège <em>pas</em>{" "}
            contre un acteur disposant de la clé
            <code className="font-mono"> service_role</code>, qui pourrait recalculer la chaîne d'un
            seul coup.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières actions sensibles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sensitive.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune action sensible récente.</p>
          )}
          {sensitive.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center gap-2 text-xs border-b border-border py-1.5"
            >
              <span className="font-mono text-muted-foreground">#{l.seq}</span>
              <Badge variant="outline">{l.action}</Badge>
              <span className="text-muted-foreground">
                {new Date(l.created_at).toLocaleString()}
              </span>
              {l.actor_discord_id && (
                <code className="font-mono text-[10px] text-muted-foreground">
                  {l.actor_discord_id}
                </code>
              )}
              {l.payload && (
                <code className="font-mono text-[10px] text-muted-foreground truncate max-w-[40ch]">
                  {JSON.stringify(l.payload)}
                </code>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
