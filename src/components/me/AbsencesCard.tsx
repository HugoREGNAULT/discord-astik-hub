/**
 * Carte « Mes absences » — le membre connecté liste, pose et supprime ses absences.
 * Réutilise listMyAbsences (me) + createAbsence/deleteAbsence (ownership vérifié côté serveur).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { listMyAbsences } from "@/lib/data/me.functions";
import { createAbsence, deleteAbsence } from "@/lib/data/absences.functions";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacances",
  irl: "IRL",
  illness: "Maladie",
  other: "Autre",
};

export function AbsencesCard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyAbsences);
  const createFn = useServerFn(createAbsence);
  const deleteFn = useServerFn(deleteAbsence);

  const { data } = useQuery({
    queryKey: ["me", "absences"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [type, setType] = useState("vacation");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["me", "absences"] });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: { type, reason: reason.trim() || undefined, startsOn, endsOn },
      }),
    onSuccess: () => {
      toast.success("Absence enregistrée");
      setOpen(false);
      setStartsOn("");
      setEndsOn("");
      setReason("");
      setType("vacation");
      invalidate();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Absence supprimée");
      invalidate();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const onCreate = () => {
    if (!startsOn || !endsOn) {
      toast.error("Renseigne les deux dates");
      return;
    }
    if (endsOn < startsOn) {
      toast.error("La date de fin doit suivre la date de début");
      return;
    }
    createMut.mutate();
  };

  const absences = data?.absences ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarOff className="size-4 text-primary" /> Mes absences
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> Poser
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {absences.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Aucune absence prévue. Préviens la faction si tu pars quelques jours.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {absences.map((a) => (
              <li key={a.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{TYPE_LABELS[a.type] ?? a.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.starts_on).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(a.ends_on).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {a.reason && (
                    <div className="text-xs text-muted-foreground truncate">{a.reason}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(a.id)}
                  disabled={deleteMut.isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Supprimer"
                  aria-label="Supprimer l'absence"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Poser une absence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="abs-type">Type</Label>
              <select
                id="abs-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="abs-start">Du</Label>
                <input
                  id="abs-start"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="abs-end">Au</Label>
                <input
                  id="abs-end"
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abs-reason">Motif (optionnel)</Label>
              <Textarea
                id="abs-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                rows={2}
                placeholder="ex: vacances en famille"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button onClick={onCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
