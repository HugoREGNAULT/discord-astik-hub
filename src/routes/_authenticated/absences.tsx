import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Plane,
  Home as HomeIcon,
  Stethoscope,
  HelpCircle,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import {
  listAbsences,
  createAbsence,
  updateAbsence,
  deleteAbsence,
} from "@/lib/data/absences.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/absences")({
  head: () => ({ meta: [{ title: "Absences · PunkAstik" }] }),
  component: AbsencesPage,
});

type AbsenceType = "vacation" | "irl" | "illness" | "other";

const TYPE_META: Record<AbsenceType, { label: string; icon: any; cls: string; dot: string }> = {
  vacation: {
    label: "Vacances",
    icon: Plane,
    cls: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    dot: "bg-sky-500",
  },
  irl: {
    label: "IRL",
    icon: HomeIcon,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  illness: {
    label: "Maladie",
    icon: Stethoscope,
    cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
  },
  other: {
    label: "Autre",
    icon: HelpCircle,
    cls: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - day);
  return out;
}

function endOfWeek(d: Date): Date {
  const out = startOfWeek(d);
  out.setDate(out.getDate() + 6);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function AbsencesPage() {
  const { data: me } = useCurrentUser();
  const canManageAll = hasPerm(me, "members.edit");
  const qc = useQueryClient();

  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));

  const gridStart = startOfWeek(startOfMonth(cursor));
  const gridEnd = endOfWeek(endOfMonth(cursor));

  const listFn = useServerFn(listAbsences);
  const { data, isLoading } = useQuery({
    queryKey: ["absences", toISODate(gridStart), toISODate(gridEnd)],
    queryFn: () => listFn({ data: { from: toISODate(gridStart), to: toISODate(gridEnd) } }),
  });

  const absences = data?.absences ?? [];
  const myId = data?.myDiscordId;

  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [gridStart, gridEnd]);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of days) map.set(toISODate(d), []);
    for (const a of absences) {
      const s = parseISODate(a.starts_on);
      const e = parseISODate(a.ends_on);
      for (let d = new Date(s); d <= e; d = addDays(d, 1)) {
        const key = toISODate(d);
        const list = map.get(key);
        if (list) list.push(a);
      }
    }
    return map;
  }, [absences, days]);

  const myAbsences = useMemo(
    () => absences.filter((a: any) => a.member_discord_id === myId),
    [absences, myId],
  );

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          code="// absences"
          title="Calendrier des absences"
          description="Vue globale des absences déclarées par les membres de la faction."
        />
        <CreateOrEditDialog
          mode="create"
          onDone={() => qc.invalidateQueries({ queryKey: ["absences"] })}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
              Aujourd&apos;hui
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              aria-label="Mois suivant"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="px-1 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = toISODate(d);
              const list = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              return (
                <div
                  key={key}
                  className={`min-h-20 sm:min-h-24 border rounded-md p-1 flex flex-col gap-1 overflow-hidden ${
                    inMonth ? "bg-card" : "bg-muted/30 opacity-60"
                  } ${isToday ? "border-primary/60 ring-1 ring-primary/30" : "border-border"}`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className={`font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {d.getDate()}
                    </span>
                    {list.length > 0 && (
                      <span className="text-muted-foreground">{list.length}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {list.slice(0, 3).map((a: any) => {
                      const meta = TYPE_META[a.type as AbsenceType] ?? TYPE_META.other;
                      return (
                        <div
                          key={a.id}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${meta.cls}`}
                          title={`${a.member_name} — ${meta.label}${a.reason ? ` · ${a.reason}` : ""}`}
                        >
                          {a.member_name}
                        </div>
                      );
                    })}
                    {list.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1">
                        +{list.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {Object.entries(TYPE_META).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${v.dot}`} />
                {v.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes absences</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : myAbsences.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="Aucune absence déclarée"
              description="Ajoute une absence pour prévenir le reste de la faction."
            />
          ) : (
            <AbsenceList
              items={myAbsences}
              canManage
              onChanged={() => qc.invalidateQueries({ queryKey: ["absences"] })}
            />
          )}
        </CardContent>
      </Card>

      {canManageAll && absences.some((a: any) => a.member_discord_id !== myId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toutes les absences du mois (staff)</CardTitle>
          </CardHeader>
          <CardContent>
            <AbsenceList
              items={absences.filter((a: any) => a.member_discord_id !== myId)}
              canManage
              onChanged={() => qc.invalidateQueries({ queryKey: ["absences"] })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AbsenceList({
  items,
  canManage,
  onChanged,
}: {
  items: any[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const delFn = useServerFn(deleteAbsence);
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Absence supprimée");
      onChanged();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  return (
    <ul className="divide-y divide-border">
      {items.map((a) => {
        const meta = TYPE_META[a.type as AbsenceType] ?? TYPE_META.other;
        const Icon = meta.icon;
        return (
          <li key={a.id} className="py-3 flex items-center gap-3">
            <Badge variant="outline" className={`gap-1 ${meta.cls}`}>
              <Icon className="size-3" /> {meta.label}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.member_name}</div>
              <div className="text-xs text-muted-foreground">
                {parseISODate(a.starts_on).toLocaleDateString("fr-FR")} →{" "}
                {parseISODate(a.ends_on).toLocaleDateString("fr-FR")}
                {a.reason && ` · ${a.reason}`}
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <CreateOrEditDialog mode="edit" absence={a} onDone={onChanged} />
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm" aria-label="Supprimer">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Supprimer cette absence ?"
                  description="Cette action est irréversible."
                  confirmLabel="Supprimer"
                  onConfirm={async () => {
                    await mDel.mutateAsync(a.id);
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CreateOrEditDialog({
  mode,
  absence,
  onDone,
}: {
  mode: "create" | "edit";
  absence?: any;
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

  const submit = async () => {
    if (endsOn < startsOn) {
      toast.error("La date de fin doit être après le début");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createFn({
          data: { type, reason: reason.trim() || undefined, startsOn, endsOn },
        });
        toast.success("Absence déclarée");
      } else {
        await updateFn({
          data: { id: absence.id, type, reason: reason.trim() || undefined, startsOn, endsOn },
        });
        toast.success("Absence mise à jour");
      }
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(toUserMessage(e));
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
                {(
                  Object.entries(TYPE_META) as [AbsenceType, (typeof TYPE_META)[AbsenceType]][]
                ).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <v.icon className="size-4" /> {v.label}
                    </span>
                  </SelectItem>
                ))}
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
