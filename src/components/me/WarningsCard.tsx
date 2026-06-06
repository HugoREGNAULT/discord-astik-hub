/**
 * Carte « Mes avertissements » — affiche les avertissements du membre et permet
 * d'en contester un en un clic (submitWarningAppeal), avec le statut de l'appel.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { listMyWarnings, submitWarningAppeal } from "@/lib/data/me.functions";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

const APPEAL_STATUS: Record<string, { label: string; variant: "secondary" | "outline" }> = {
  pending: { label: "Contestation en cours d'examen", variant: "secondary" },
  accepted: { label: "Contestation acceptée", variant: "secondary" },
  rejected: { label: "Contestation refusée", variant: "outline" },
};

export function WarningsCard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyWarnings);
  const appealFn = useServerFn(submitWarningAppeal);

  const { data } = useQuery({
    queryKey: ["me", "warnings"],
    queryFn: () => listFn(),
  });

  const [appealId, setAppealId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const mut = useMutation({
    mutationFn: () => appealFn({ data: { warningId: appealId!, message: message.trim() } }),
    onSuccess: () => {
      toast.success("Contestation envoyée");
      setAppealId(null);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["me", "warnings"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const warnings = data?.warnings ?? [];
  if (warnings.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" /> Mes avertissements
          </span>
          <Badge variant="outline">{warnings.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {warnings.map((w) => {
            const appeal = w.appeal;
            const canAppeal = w.status === "active" && !appeal;
            return (
              <li key={w.id} className="text-sm border border-border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{w.severity ?? "minor"}</Badge>
                  <Badge variant="secondary">{w.status}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(w.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div>{w.body}</div>

                {appeal && (
                  <div className="mt-2 text-xs">
                    <Badge variant={APPEAL_STATUS[appeal.status]?.variant ?? "outline"}>
                      {APPEAL_STATUS[appeal.status]?.label ?? appeal.status}
                    </Badge>
                    {appeal.decision_note && (
                      <p className="mt-1 text-muted-foreground">{appeal.decision_note}</p>
                    )}
                  </div>
                )}

                {canAppeal && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAppealId(w.id);
                        setMessage("");
                      }}
                    >
                      Contester
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>

      <Dialog open={appealId !== null} onOpenChange={(o) => !o && setAppealId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contester l'avertissement</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="appeal-msg">Explique ta contestation (10 caractères min.)</Label>
            <Textarea
              id="appeal-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={4}
              placeholder="Donne ta version des faits, calmement et factuellement…"
            />
            <div className="text-right text-xs text-muted-foreground">{message.length}/2000</div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || message.trim().length < 10}
            >
              {mut.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
