import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";

import { PageHeader } from "@/components/tools/ToolsUi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins, Eye, Check, X, History } from "lucide-react";

import {
  listSalaryGrades,
  upsertSalaryGrade,
  previewSalaryRun,
  commitSalaryRun,
  cancelSalaryRun,
  listSalaryRuns,
  getSalaryRun,
  type SalaryGrade,
  type SalaryBreakdownLine,
} from "@/lib/data/salary.functions";

export const Route = createFileRoute("/_authenticated/salaries")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Salaires · PunkAstik" }] }),
  component: () => (
    <Guard perm="points.manage">
      <SalariesPage />
    </Guard>
  ),
});

function lastWeekRange() {
  const now = new Date();
  const day = now.getUTCDay();
  const sinceThisMon = (day + 6) % 7;
  const thisMon = new Date(now);
  thisMon.setUTCDate(now.getUTCDate() - sinceThisMon);
  const lastMon = new Date(thisMon);
  lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(lastMon);
  lastSun.setUTCDate(lastMon.getUTCDate() + 6);
  return {
    periodStart: lastMon.toISOString().slice(0, 10),
    periodEnd: lastSun.toISOString().slice(0, 10),
  };
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SalariesPage() {
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <PageHeader icon={Coins} title="Salaires" subtitle="Paie hebdomadaire en AstikPoints" />
      <GradesCard />
      <PreviewCard />
      <RunsHistoryCard />
    </div>
  );
}

// ----------------- Barème -----------------

function GradesCard() {
  const fn = useServerFn(listSalaryGrades);
  const { data, isLoading } = useQuery({ queryKey: ["salary-grades"], queryFn: () => fn() });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Barème par grade</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_140px_140px_100px] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground px-2">
              <div>Grade</div>
              <div className="text-right">Points / semaine</div>
              <div className="text-right">Activité min (s)</div>
              <div className="text-center">Actif</div>
            </div>
            {(data?.grades ?? []).map((g) => (
              <GradeRow key={g.id} grade={g} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GradeRow({ grade }: { grade: SalaryGrade }) {
  const qc = useQueryClient();
  const fn = useServerFn(upsertSalaryGrade);
  const [points, setPoints] = useState(grade.weekly_points);
  const [minAct, setMinAct] = useState(grade.min_activity_seconds);
  const [active, setActive] = useState(grade.active);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: grade.id,
          gradeLabel: grade.grade_label,
          weeklyPoints: points,
          minActivitySeconds: minAct,
          active,
        },
      }),
    onSuccess: () => {
      toast.success("Barème mis à jour");
      qc.invalidateQueries({ queryKey: ["salary-grades"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const dirty =
    points !== grade.weekly_points ||
    minAct !== grade.min_activity_seconds ||
    active !== grade.active;

  return (
    <div className="grid grid-cols-[1fr_140px_140px_100px_auto] gap-2 items-center border border-border rounded p-2">
      <div className="text-sm font-medium">{grade.grade_label}</div>
      <Input
        type="number"
        min={0}
        value={points}
        onChange={(e) => setPoints(Math.max(0, Number(e.target.value) || 0))}
        className="text-right"
      />
      <Input
        type="number"
        min={0}
        value={minAct}
        onChange={(e) => setMinAct(Math.max(0, Number(e.target.value) || 0))}
        className="text-right"
      />
      <div className="flex justify-center">
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
      <Button size="sm" disabled={!dirty || mut.isPending} onClick={() => mut.mutate()}>
        {mut.isPending ? "…" : "Enregistrer"}
      </Button>
    </div>
  );
}

// ----------------- Aperçu -----------------

function PreviewCard() {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewSalaryRun);
  const commitFn = useServerFn(commitSalaryRun);
  const cancelFn = useServerFn(cancelSalaryRun);

  const defaults = useMemo(() => lastWeekRange(), []);
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);

  const [preview, setPreview] = useState<{
    runId: string;
    breakdown: SalaryBreakdownLine[];
    total: number;
    recipients: number;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const previewMut = useMutation({
    mutationFn: () => previewFn({ data: { periodStart, periodEnd } }),
    onSuccess: (res) => {
      const runId = (res.run as { id: string }).id;
      setPreview({
        runId,
        breakdown: res.breakdown,
        total: res.total,
        recipients: res.recipients,
      });
      qc.invalidateQueries({ queryKey: ["salary-runs"] });
      toast.success("Aperçu généré");
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const commitMut = useMutation({
    mutationFn: () => commitFn({ data: { runId: preview!.runId } }),
    onSuccess: (res) => {
      toast.success(`${res.total.toLocaleString("fr-FR")} pts versés à ${res.recipients} membres`);
      setPreview(null);
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["salary-runs"] });
    },
    onError: (e: Error) => {
      toast.error(toUserMessage(e));
      setConfirmOpen(false);
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { runId: preview!.runId } }),
    onSuccess: () => {
      toast.success("Aperçu annulé");
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["salary-runs"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4" /> Aperçu de la semaine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] uppercase text-muted-foreground">Début</label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground">Fin</label>
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
            {previewMut.isPending ? "Calcul…" : "Générer l'aperçu"}
          </Button>
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="text-base">
                Total : <strong className="ml-1">{preview.total.toLocaleString("fr-FR")} pts</strong>
              </Badge>
              <Badge variant="outline" className="text-base">
                Bénéficiaires : <strong className="ml-1">{preview.recipients}</strong>
              </Badge>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                  <X className="size-3.5 mr-1" /> Annuler
                </Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={preview.recipients === 0}
                >
                  <Check className="size-3.5 mr-1" /> Valider le versement
                </Button>
              </div>
            </div>

            <div className="border border-border rounded max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Membre</th>
                    <th className="text-left p-2">Grade</th>
                    <th className="text-right p-2">Points</th>
                    <th className="text-left p-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.breakdown.map((l) => (
                    <tr key={l.discord_id} className="border-t border-border">
                      <td className="p-2">
                        <Link
                          to="/members/$id"
                          params={{ id: l.discord_id }}
                          className="hover:underline"
                        >
                          {l.ig_name ?? l.discord_username ?? l.discord_id}
                        </Link>
                      </td>
                      <td className="p-2 text-muted-foreground">{l.grade}</td>
                      <td className="p-2 text-right tabular-nums">
                        {l.excluded ? "—" : l.points.toLocaleString("fr-FR")}
                      </td>
                      <td className="p-2 text-[11px] text-amber-500">
                        {l.excluded?.reason ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer le versement</AlertDialogTitle>
              <AlertDialogDescription>
                Verser{" "}
                <strong>{preview?.total.toLocaleString("fr-FR")} points</strong> à{" "}
                <strong>{preview?.recipients} membres</strong> ? Cette action crédite
                immédiatement les AstikPoints et ne peut pas être annulée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={commitMut.isPending}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  commitMut.mutate();
                }}
                disabled={commitMut.isPending}
              >
                {commitMut.isPending ? "Versement…" : "Verser"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ----------------- Historique -----------------

function RunsHistoryCard() {
  const fn = useServerFn(listSalaryRuns);
  const { data, isLoading } = useQuery({ queryKey: ["salary-runs"], queryFn: () => fn() });
  const runs = data?.runs ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" /> Historique
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun versement encore.
          </p>
        ) : (
          <div className="border border-border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2">Période</th>
                  <th className="text-left p-2">Statut</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Bénéficiaires</th>
                  <th className="text-left p-2">Validé</th>
                  <th className="text-left p-2">Par</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2">
                      {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {(r.total_points ?? 0).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.recipient_count ?? 0}</td>
                    <td className="p-2 text-[11px] text-muted-foreground">
                      {fmtDate(r.committed_at)}
                    </td>
                    <td className="p-2 text-[11px] text-muted-foreground">
                      {r.created_by_username ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "committed")
    return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40">Versé</Badge>;
  if (status === "cancelled")
    return <Badge variant="outline" className="text-muted-foreground">Annulé</Badge>;
  return <Badge variant="outline" className="text-amber-500 border-amber-500/40">Aperçu</Badge>;
}

// satisfies linter
void getSalaryRun;
