import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { Gavel, Check, X } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { listAppeals, decideAppeal } from "@/lib/data/appeals.functions";

export const Route = createFileRoute("/_authenticated/staff/appeals")({
  head: () => ({ meta: [{ title: "Appels d'avertissements · Staff" }] }),
  component: () => (
    <Guard permission="warnings.write">
      <AppealsPage />
    </Guard>
  ),
});

function AppealsPage() {
  const qc = useQueryClient();
  const ls = useServerFn(listAppeals);
  const dec = useServerFn(decideAppeal);

  const [filter, setFilter] = useState<"pending" | "accepted" | "rejected" | "all">("pending");
  const { data, isLoading } = useQuery({
    queryKey: ["staff-appeals", filter],
    queryFn: () => ls({ data: { status: filter } }),
  });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const decide = useMutation({
    mutationFn: (vars: { appealId: string; decision: "accepted" | "rejected"; note?: string }) =>
      dec({ data: vars }),
    onSuccess: () => {
      toast.success("Décision enregistrée");
      qc.invalidateQueries({ queryKey: ["staff-appeals"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const list = data?.appeals ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        code="// staff / appeals"
        title="Appels d'avertissements"
        description="Sanctions contestées par les membres."
      />

      <div className="flex gap-2">
        {(["pending", "accepted", "rejected", "all"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : list.length === 0 ? (
        <EmptyState icon={Gavel} title="Aucun appel" description="Rien à traiter ici." />
      ) : (
        <div className="space-y-3">
          {list.map((a: any) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {a.member?.ig_name ?? a.member?.discord_username ?? a.member_discord_id}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {a.warning?.severity && (
                      <Badge variant="outline">{a.warning.severity}</Badge>
                    )}
                    {a.warning?.category && (
                      <Badge variant="outline">{a.warning.category}</Badge>
                    )}
                    <Badge
                      variant={
                        a.status === "pending"
                          ? "secondary"
                          : a.status === "accepted"
                            ? "default"
                            : "destructive"
                      }
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {a.warning?.body && (
                  <div className="rounded-md bg-muted p-2 text-xs">
                    <div className="font-medium mb-1">Sanction</div>
                    <div className="whitespace-pre-wrap">{a.warning.body}</div>
                  </div>
                )}
                <div>
                  <div className="font-medium text-xs mb-1">Message du membre</div>
                  <p className="whitespace-pre-wrap">{a.message}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Soumis le {new Date(a.created_at).toLocaleString("fr-FR")}
                </div>

                {a.status === "pending" ? (
                  <div className="space-y-2 pt-1 border-t">
                    <Textarea
                      placeholder="Note (optionnel, envoyée au membre)"
                      value={notes[a.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            appealId: a.id,
                            decision: "accepted",
                            note: notes[a.id] || undefined,
                          })
                        }
                      >
                        <Check className="size-4 mr-1" /> Accepter
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            appealId: a.id,
                            decision: "rejected",
                            note: notes[a.id] || undefined,
                          })
                        }
                      >
                        <X className="size-4 mr-1" /> Rejeter
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Décidé par {a.decided_by_username ?? "—"} le{" "}
                    {a.decided_at ? new Date(a.decided_at).toLocaleString("fr-FR") : "—"}
                    {a.decision_note ? ` — ${a.decision_note}` : ""}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
