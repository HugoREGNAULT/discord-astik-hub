/**
 * Dialog création/édition d'une absence.
 * - Validation client (fin >= début).
 * - Confirmation au-delà de 60 jours (évite « j'ai cliqué sur 2027 par erreur »).
 * - Le serveur empêche le chevauchement (createAbsence/updateAbsence).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAbsence, updateAbsence } from "@/lib/data/absences.functions";
import { toUserMessage } from "@/lib/errors";
import {
  TYPE_META,
  ABSENCE_TYPES,
  toISODate,
  daysBetween,
  type AbsenceType,
  type AbsenceRow,
} from "@/components/absences/types";

const LONG_THRESHOLD_DAYS = 60;

export function CreateOrEditDialog({
  mode,
  absence,
  onDone,
}: {
  mode: "create" | "edit";
  absence?: AbsenceRow;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AbsenceType>((absence?.type as AbsenceType) ?? "vacation");
  const [reason, setReason] = useState<string>(absence?.reason ?? "");
  const [startsOn, setStartsOn] = useState<string>(absence?.starts_on ?? toISODate(new Date()));
  const [endsOn, setEndsOn] = useState<string>(absence?.ends_on ?? toISODate(new Date()));
  const [submitting, setSubmitting] = useState(false);

  const createFn = useServerFn(createAbsence);
  const updateFn = useServerFn(updateAbsence);

  const duration = daysBetween(startsOn, endsOn);
  const isLong = duration > LONG_THRESHOLD_DAYS;

  const submit = async () => {
    if (endsOn < startsOn) {
      toast.error("La date de fin doit être après le début");
      return;
    }
    if (isLong) {
      const ok = window.confirm(
        `Cette absence dure ${duration} jours. Confirmer ? (au-delà de ${LONG_THRESHOLD_DAYS} jours, vérifie bien tes dates)`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createFn({
          data: { type, reason: reason.trim() || undefined, startsOn, endsOn },
        });
        toast.success("Absence déclarée");
      } else if (absence) {
        await updateFn({
          data: { id: absence.id, type, reason: reason.trim() || undefined, startsOn, endsOn },
        });
        toast.success("Absence mise à jour");
      }
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(toUserMessage(e as Error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="size-4" /> Déclarer une absence
          </Button>
        ) : (
          <Button variant="ghost" size="sm" aria-label="Modifier">
            <Pencil className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Déclarer une absence" : "Modifier l'absence"}
          </DialogTitle>
          <DialogDescription>
            Les autres membres verront ton nom sur le calendrier pendant cette période.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ABSENCE_TYPES.map((k) => {
                  const v = TYPE_META[k];
                  const Icon = v.icon;
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" /> {v.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="abs-from">Début</Label>
              <Input
                id="abs-from"
                type="date"
                value={startsOn}
                onChange={(e) => {
                  setStartsOn(e.target.value);
                  if (endsOn < e.target.value) setEndsOn(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abs-to">Fin</Label>
              <Input
                id="abs-to"
                type="date"
                value={endsOn}
                min={startsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Durée :{" "}
              <span className={isLong ? "text-amber-500 font-semibold" : ""}>
                {duration} jour{duration > 1 ? "s" : ""}
                {isLong ? " ⚠" : ""}
              </span>
            </span>
            {isLong && <span className="text-amber-500">Plus de {LONG_THRESHOLD_DAYS} j</span>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="abs-reason">Note (optionnel)</Label>
            <Textarea
              id="abs-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Examens, vacances en famille, …"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {mode === "create" ? "Déclarer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
