import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import {
  listProjects,
  getProject,
  upsertProject,
  deleteProject,
  upsertResource,
  deleteResource,
  addContribution,
} from "@/lib/data/projects.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Plus, Trash2, Calendar, AlertCircle, Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projets · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <ProjectsPage />
    </Guard>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  planned: "Planifié",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  planned: "outline",
  in_progress: "default",
  completed: "secondary",
  cancelled: "destructive",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-orange-500",
  urgent: "text-red-500 font-bold",
};

function ProjectsPage() {
  const me = useCurrentUser();
  const canEdit = hasPerm(me.data, "members.edit");
  const qc = useQueryClient();
  const ls = useServerFn(listProjects);

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => ls(),
  });

  const projects = data?.projects ?? [];
  const resources = data?.resources ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });

  return (
    <div className="space-y-6">
      <PageHeader
        code="// projects"
        title="Projets de faction"
        description="Suivez l'avancement des projets en cours, les ressources qu'il reste à fournir, et les valeurs en points par item."
        right={canEdit ? <NewProjectDialog onDone={refresh} /> : undefined}
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucun projet"
          description={canEdit ? "Crée le premier projet pour la faction." : "Le staff n'a pas encore créé de projets."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((p: any) => (
            <ProjectCard
              key={p.id}
              project={p}
              resources={resources.filter((r: any) => r.project_id === p.id)}
              canEdit={canEdit}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  resources,
  canEdit,
  onRefresh,
}: {
  project: any;
  resources: any[];
  canEdit: boolean;
  onRefresh: () => void;
}) {
  const totalNeeded = resources.reduce((s, r) => s + Number(r.qty_needed || 0), 0);
  const totalCollected = resources.reduce((s, r) => s + Number(r.qty_collected || 0), 0);
  const pct = totalNeeded > 0 ? Math.min(100, Math.round((totalCollected / totalNeeded) * 100)) : 0;

  const missing = resources
    .map((r) => ({ ...r, missing: Math.max(0, Number(r.qty_needed) - Number(r.qty_collected)) }))
    .filter((r) => r.missing > 0);

  const deadlineWarn =
    project.deadline &&
    new Date(project.deadline).getTime() - Date.now() < 7 * 86400_000 &&
    project.status !== "completed";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span className="truncate">{project.title}</span>
              <Badge variant={STATUS_VARIANT[project.status] || "outline"}>
                {STATUS_LABEL[project.status] || project.status}
              </Badge>
              <span className={`text-xs ${PRIORITY_COLOR[project.priority] || ""}`}>
                · {project.priority}
              </span>
            </CardTitle>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2 flex-wrap">
              {project.deadline && (
                <span className={`flex items-center gap-1 ${deadlineWarn ? "text-orange-500" : ""}`}>
                  <Calendar className="size-3" />
                  {new Date(project.deadline).toLocaleDateString("fr-FR")}
                </span>
              )}
              {project.owner_username && <span>Resp: {project.owner_username}</span>}
            </div>
          </div>
          {canEdit && (
            <ProjectEditMenu project={project} onDone={onRefresh} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalNeeded > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Avancement global</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        )}

        {resources.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune ressource définie.</p>
        ) : (
          <ul className="space-y-1.5">
            {resources.map((r) => {
              const rPct = Number(r.qty_needed) > 0
                ? Math.min(100, Math.round((Number(r.qty_collected) / Number(r.qty_needed)) * 100))
                : 0;
              return (
                <li key={r.id} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate flex-1">{r.item_name}</span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {Number(r.qty_collected).toLocaleString("fr-FR")} / {Number(r.qty_needed).toLocaleString("fr-FR")}
                      {r.unit_points ? ` · ${r.unit_points} pts/u` : ""}
                    </span>
                  </div>
                  <Progress value={rPct} className="h-1 mt-1" />
                </li>
              );
            })}
          </ul>
        )}

        {missing.length > 0 && (
          <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2 text-xs">
            <div className="flex items-center gap-1 font-medium text-orange-500 mb-1">
              <AlertCircle className="size-3" /> Il manque
            </div>
            <ul className="space-y-0.5">
              {missing.slice(0, 5).map((r) => (
                <li key={r.id} className="font-mono">
                  • {Number(r.missing).toLocaleString("fr-FR")} {r.item_name}
                </li>
              ))}
              {missing.length > 5 && <li className="text-muted-foreground">+ {missing.length - 5} autres…</li>}
            </ul>
          </div>
        )}

        {canEdit && (
          <ProjectDetailDialog projectId={project.id} resources={resources} onRefresh={onRefresh} />
        )}
      </CardContent>
    </Card>
  );
}

function NewProjectDialog({ onDone }: { onDone: () => void }) {
  const up = useServerFn(upsertProject);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal", deadline: "" });

  const m = useMutation({
    mutationFn: () =>
      up({
        data: {
          title: form.title,
          description: form.description || null,
          priority: form.priority as any,
          deadline: form.deadline || null,
        },
      }),
    onSuccess: () => {
      toast.success("Projet créé");
      setForm({ title: "", description: "", priority: "normal", deadline: "" });
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1" />
          Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Titre</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Deadline</label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={!form.title || m.isPending}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectEditMenu({ project, onDone }: { project: any; onDone: () => void }) {
  const up = useServerFn(upsertProject);
  const del = useServerFn(deleteProject);

  const updateStatus = async (status: string) => {
    try {
      await up({ data: { id: project.id, title: project.title, status: status as any, priority: project.priority } });
      toast.success("Statut mis à jour");
      onDone();
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={project.status}
        onChange={(e) => updateStatus(e.target.value)}
        className="bg-input border border-border rounded text-xs px-2 py-1"
      >
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <ConfirmDialog
        title="Supprimer le projet ?"
        description="Toutes les ressources et contributions seront supprimées. Irréversible."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          try {
            await del({ data: { id: project.id } });
            toast.success("Projet supprimé");
            onDone();
          } catch (e) {
            toast.error(toUserMessage(e));
            throw e;
          }
        }}
        trigger={
          <Button variant="ghost" size="icon" className="text-destructive size-7">
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
    </div>
  );
}

function ProjectDetailDialog({
  projectId,
  resources,
  onRefresh,
}: {
  projectId: string;
  resources: any[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const upR = useServerFn(upsertResource);
  const delR = useServerFn(deleteResource);
  const addC = useServerFn(addContribution);
  const me = useCurrentUser();

  const [newRes, setNewRes] = useState({ item_name: "", qty_needed: 0, unit_points: 0 });
  const [contrib, setContrib] = useState({ resource_id: "", quantity: 0 });

  const addRes = async () => {
    if (!newRes.item_name || newRes.qty_needed <= 0) {
      toast.error("Nom et quantité requis");
      return;
    }
    try {
      await upR({
        data: {
          project_id: projectId,
          item_name: newRes.item_name,
          qty_needed: newRes.qty_needed,
          unit_points: newRes.unit_points || null,
          qty_collected: 0,
          display_order: resources.length,
        },
      });
      setNewRes({ item_name: "", qty_needed: 0, unit_points: 0 });
      toast.success("Ressource ajoutée");
      onRefresh();
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const doContrib = async () => {
    const r = resources.find((x) => x.id === contrib.resource_id);
    if (!r || contrib.quantity <= 0) {
      toast.error("Ressource et quantité requises");
      return;
    }
    try {
      await addC({
        data: {
          project_id: projectId,
          resource_id: r.id,
          member_discord_id: me.data?.discordId ?? "",
          member_username: me.data?.username ?? null,
          item_name: r.item_name,
          quantity: contrib.quantity,
          points_awarded: r.unit_points ? Number(r.unit_points) * contrib.quantity : null,
        },
      });
      toast.success("Contribution enregistrée");
      setContrib({ resource_id: "", quantity: 0 });
      onRefresh();
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Gérer ressources & contributions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Détails du projet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Ressources</h4>
            <ul className="space-y-1 mb-3 max-h-48 overflow-y-auto">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{r.item_name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {Number(r.qty_collected)}/{Number(r.qty_needed)}
                    {r.unit_points ? ` · ${r.unit_points}pts/u` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive"
                    onClick={async () => {
                      try {
                        await delR({ data: { id: r.id } });
                        onRefresh();
                      } catch (e) {
                        toast.error(toUserMessage(e));
                      }
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </li>
              ))}
              {resources.length === 0 && (
                <li className="text-xs text-muted-foreground italic">Aucune ressource.</li>
              )}
            </ul>
            <div className="grid grid-cols-[1fr_80px_80px_auto] gap-2">
              <Input
                placeholder="Item"
                value={newRes.item_name}
                onChange={(e) => setNewRes({ ...newRes, item_name: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Qté"
                value={newRes.qty_needed || ""}
                onChange={(e) => setNewRes({ ...newRes, qty_needed: parseFloat(e.target.value) || 0 })}
              />
              <Input
                type="number"
                step="any"
                placeholder="pts/u"
                value={newRes.unit_points || ""}
                onChange={(e) => setNewRes({ ...newRes, unit_points: parseFloat(e.target.value) || 0 })}
              />
              <Button size="sm" onClick={addRes}>
                +
              </Button>
            </div>
          </div>

          {resources.length > 0 && (
            <div className="border-t border-border pt-3">
              <h4 className="text-sm font-medium mb-2">Ajouter une contribution</h4>
              <div className="grid grid-cols-[1fr_100px_auto] gap-2">
                <select
                  value={contrib.resource_id}
                  onChange={(e) => setContrib({ ...contrib, resource_id: e.target.value })}
                  className="bg-input border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— ressource —</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.item_name}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="Qté"
                  value={contrib.quantity || ""}
                  onChange={(e) => setContrib({ ...contrib, quantity: parseFloat(e.target.value) || 0 })}
                />
                <Button size="sm" onClick={doContrib}>
                  OK
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                La contribution est attribuée à toi-même. Pour attribuer à un autre membre, utilise /points avec la raison "Projet: {projectId.slice(0, 8)}".
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
