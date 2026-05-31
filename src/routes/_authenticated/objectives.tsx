import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listObjectives,
  createObjective,
  toggleObjective,
  deleteObjective,
  listObjectiveContributions,
  addContribution,
  removeContribution,
  distributeObjectiveReward,
} from "@/lib/data/objectives.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Trash2, Target, Gift } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/objectives")({
  head: () => ({ meta: [{ title: "Objectifs · PunkAstik" }] }),
  component: ObjectivesPage,
});

function ObjectivesPage() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const canEdit = hasPerm(user, "objectives.edit");

  const ls = useServerFn(listObjectives);
  const cr = useServerFn(createObjective);
  const tog = useServerFn(toggleObjective);
  const del = useServerFn(deleteObjective);

  const { data } = useQuery({ queryKey: ["objectives"], queryFn: () => ls() });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["objectives"] });

  const add = useMutation({
    mutationFn: () =>
      cr({
        data: {
          title,
          description: desc || undefined,
          targetValue: targetValue ? Number(targetValue) : undefined,
          unit: unit || undefined,
          rewardPoints: rewardPoints ? Number(rewardPoints) : undefined,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setDesc("");
      setTargetValue("");
      setUnit("");
      setRewardPoints("");
      toast.success("Objectif créé");
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });
  const togM = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) => tog({ data: vars }),
    onSuccess: () => refresh(),
    onError: (e: any) => toast.error(toUserMessage(e)),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Objectif supprimé");
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        code="// objectives"
        title="Objectifs faction"
        description="Les buts en cours pour la faction."
      />

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nouvel objectif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              placeholder="Description (optionnel)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="Cible (jauge)"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
              <Input
                placeholder="Unité (ex: PB)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Récompense (pts)"
                value={rewardPoints}
                onChange={(e) => setRewardPoints(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Laisser la cible vide pour un objectif binaire (case à cocher).
            </p>
            <Button onClick={() => add.mutate()} disabled={!title || add.isPending}>
              Créer
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {data?.objectives.map((o: any) =>
          o.target_value != null ? (
            <GaugeObjectiveCard
              key={o.id}
              objective={o}
              canEdit={canEdit}
              onDelete={() => delM.mutate(o.id)}
              deleting={delM.isPending}
            />
          ) : (
            <Card key={o.id} className={o.done ? "opacity-60" : ""}>
              <CardContent className="flex items-start gap-3 py-3">
                <Checkbox
                  checked={o.done}
                  disabled={!canEdit || togM.isPending}
                  onCheckedChange={(c) => togM.mutate({ id: o.id, done: !!c })}
                />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${o.done ? "line-through" : ""}`}>{o.title}</div>
                  {o.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {o.description}
                    </p>
                  )}
                  {o.done && o.done_by_discord_id && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Validé par {o.done_by_discord_id} · {new Date(o.done_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <ConfirmDialog
                    title={`Supprimer "${o.title}" ?`}
                    description="Cet objectif sera définitivement supprimé."
                    confirmLabel="Supprimer"
                    onConfirm={async () => {
                      await delM.mutateAsync(o.id);
                    }}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={delM.isPending}
                        aria-label="Supprimer l'objectif"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          ),
        )}
        {data?.objectives.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Target}
              title="Aucun objectif"
              description="Les objectifs collectifs apparaîtront ici."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GaugeObjectiveCard({
  objective: o,
  canEdit,
  onDelete,
  deleting,
}: {
  objective: any;
  canEdit: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const qc = useQueryClient();
  const lsC = useServerFn(listObjectiveContributions);
  const addC = useServerFn(addContribution);
  const rmC = useServerFn(removeContribution);
  const dist = useServerFn(distributeObjectiveReward);

  const { data: contribs } = useQuery({
    queryKey: ["objective-contributions", o.id],
    queryFn: () => lsC({ data: { objectiveId: o.id } }),
  });

  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["objectives"] });
    qc.invalidateQueries({ queryKey: ["objective-contributions", o.id] });
  };

  const addM = useMutation({
    mutationFn: () =>
      addC({
        data: {
          objectiveId: o.id,
          memberDiscordId: memberId.trim(),
          amount: Number(amount),
          note: note || undefined,
        },
      }),
    onSuccess: () => {
      setMemberId("");
      setAmount("");
      setNote("");
      toast.success("Contribution ajoutée");
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const rmM = useMutation({
    mutationFn: (id: string) => rmC({ data: { id, objectiveId: o.id } }),
    onSuccess: () => {
      toast.success("Contribution supprimée");
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const distM = useMutation({
    mutationFn: () => dist({ data: { objectiveId: o.id } }),
    onSuccess: (res: any) => {
      toast.success(`Récompense distribuée: ${res.total} pts`);
      refresh();
    },
    onError: (e: any) => toast.error(toUserMessage(e)),
  });

  const current = Number(o.current_value ?? 0);
  const target = Number(o.target_value ?? 0);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const reward = Number(o.reward_points ?? 0);

  // Preview de la répartition
  const totals = new Map<string, { username: string | null; amount: number }>();
  for (const c of contribs?.contributions ?? []) {
    const cur = totals.get(c.member_discord_id) ?? { username: c.member_username, amount: 0 };
    cur.amount += Number(c.amount);
    cur.username = c.member_username ?? cur.username;
    totals.set(c.member_discord_id, cur);
  }
  const grand = Array.from(totals.values()).reduce((a, b) => a + b.amount, 0);
  const preview = Array.from(totals.entries())
    .map(([id, v]) => ({
      discordId: id,
      username: v.username,
      amount: v.amount,
      points: grand > 0 ? Math.round(reward * (v.amount / grand)) : 0,
    }))
    .sort((a, b) => b.points - a.points);

  return (
    <Card className={o.done ? "border-primary/40" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{o.title}</CardTitle>
            {o.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                {o.description}
              </p>
            )}
          </div>
          {canEdit && (
            <ConfirmDialog
              title={`Supprimer "${o.title}" ?`}
              description="Cet objectif et ses contributions seront supprimés."
              confirmLabel="Supprimer"
              onConfirm={async () => {
                onDelete();
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  disabled={deleting}
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-mono">
              {current.toLocaleString()} / {target.toLocaleString()}
              {o.unit ? ` ${o.unit}` : ""}
            </span>
            <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
          </div>
          <Progress value={pct} />
          {reward > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Récompense: {reward} pts {o.rewarded ? "(déjà distribuée)" : "(au prorata)"}
            </p>
          )}
        </div>

        {preview.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase">Contributeurs</div>
            {preview.map((p) => (
              <div
                key={p.discordId}
                className="flex items-center justify-between text-sm border-b py-1 last:border-0"
              >
                <span className="truncate">{p.username ?? p.discordId}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.amount.toLocaleString()}
                  {o.unit ? ` ${o.unit}` : ""} ·{" "}
                  {grand > 0 ? ((p.amount / grand) * 100).toFixed(1) : "0"}%
                  {reward > 0 && !o.rewarded ? ` → ${p.points} pts` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground uppercase">
              Ajouter une contribution
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Discord ID"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Montant"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                placeholder="Note (opt.)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => addM.mutate()}
                disabled={!memberId || !amount || addM.isPending}
              >
                Ajouter
              </Button>
              {reward > 0 && !o.rewarded && preview.length > 0 && (
                <ConfirmDialog
                  title="Verser la récompense ?"
                  description={`${reward} pts seront répartis entre ${preview.length} contributeur(s) au prorata.`}
                  confirmLabel="Verser"
                  onConfirm={async () => {
                    await distM.mutateAsync();
                  }}
                  trigger={
                    <Button size="sm" variant="secondary" disabled={distM.isPending}>
                      <Gift className="size-4 mr-1" />
                      Verser la récompense
                    </Button>
                  }
                />
              )}
            </div>

            {(contribs?.contributions?.length ?? 0) > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                {contribs!.contributions.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {new Date(c.created_at).toLocaleDateString()} ·{" "}
                      {c.member_username ?? c.member_discord_id} · {Number(c.amount).toLocaleString()}
                      {o.unit ? ` ${o.unit}` : ""}
                      {c.note ? ` — ${c.note}` : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-6"
                      disabled={rmM.isPending}
                      onClick={() => rmM.mutate(c.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
