import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { PageHeader, PageCard } from "@/components/tools/ToolsUi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { CardListSkeleton } from "@/components/Skeletons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { toUserMessage } from "@/lib/errors";
import {
  listStaffTasks,
  createStaffTask,
  setStaffTaskStatus,
  deleteStaffTask,
} from "@/lib/data/staff-tasks.functions";
import { listMembers } from "@/lib/data/members.functions";

export const Route = createFileRoute("/_authenticated/staff-board")({
  head: () => ({ meta: [{ title: "Board staff · PunkAstik" }] }),
  component: StaffBoardPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  assignee_discord_id: string | null;
  assignee_username: string | null;
  priority: string;
  status: "todo" | "doing" | "done" | "cancelled";
  due_date: string | null;
  done_at: string | null;
  created_at: string;
};

type MemberLite = { discord_username: string | null; ig_name: string | null; avatar_url: string | null };

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  urgent: "bg-red-500/10 text-red-300 border-red-500/30",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "À faire" },
  { key: "doing", label: "En cours" },
  { key: "done", label: "Fait" },
];

function StaffBoardPage() {
  const { data: me } = useCurrentUser();
  const canAccess = hasPerm(me, "members.view");
  const qc = useQueryClient();

  const fetchTasks = useServerFn(listStaffTasks);
  const fetchMembers = useServerFn(listMembers);
  const createFn = useServerFn(createStaffTask);
  const setStatusFn = useServerFn(setStaffTaskStatus);
  const deleteFn = useServerFn(deleteStaffTask);

  const tasksQ = useQuery({
    queryKey: ["staff-tasks"],
    queryFn: () => fetchTasks({ data: {} }),
    enabled: canAccess,
  });
  const membersQ = useQuery({
    queryKey: ["members-lite-board"],
    queryFn: () => fetchMembers({ data: {} as any }),
    enabled: canAccess,
  });

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("none");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [toDelete, setToDelete] = useState<Task | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["staff-tasks"] });

  const createMut = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success("Tâche créée");
      setTitle("");
      setDueDate("");
      setAssignee("none");
      setPriority("normal");
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const statusMut = useMutation({
    mutationFn: (p: { id: string; status: Task["status"] }) => setStatusFn({ data: p }),
    onSuccess: invalidate,
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Supprimée");
      setToDelete(null);
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const tasks: Task[] = (tasksQ.data?.tasks ?? []) as Task[];
  const membersMap: Record<string, MemberLite> = (tasksQ.data?.members ?? {}) as any;
  const allMembers: any[] = (membersQ.data as any)?.members ?? [];

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterAssignee !== "all") {
        if (filterAssignee === "none" && t.assignee_discord_id) return false;
        if (filterAssignee !== "none" && t.assignee_discord_id !== filterAssignee) return false;
      }
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterAssignee, filterPriority]);

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader code="staff/board" title="Board staff" description="Accès staff requis." />
        <EmptyState title="Accès refusé" description="Permission staff requise." />
      </div>
    );
  }

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error("Titre requis");
      return;
    }
    createMut.mutate({
      title: title.trim(),
      assigneeDiscordId: assignee !== "none" ? assignee : undefined,
      priority,
      dueDate: dueDate || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader code="staff/board" title="Board staff" description="Le mini to-do interne de l'équipe." />

      <PageCard>
        <div className="space-y-3 p-4">
          <Label>Nouvelle tâche</Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_160px_160px_auto]">
            <Input
              placeholder="Titre..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Assigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {allMembers.map((m: any) => (
                  <SelectItem key={m.discord_id} value={m.discord_id}>
                    {m.ig_name ?? m.discord_username ?? m.discord_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Ajouter
            </Button>
          </div>
        </div>
      </PageCard>

      <PageCard>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Label className="text-xs uppercase text-muted-foreground">Filtres</Label>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Assigné" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les assignés</SelectItem>
              <SelectItem value="none">Non assigné</SelectItem>
              {allMembers.map((m: any) => (
                <SelectItem key={m.discord_id} value={m.discord_id}>
                  {m.ig_name ?? m.discord_username ?? m.discord_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageCard>

      {tasksQ.isLoading ? (
        <CardListSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </h3>
                  <Badge variant="secondary">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-xs text-muted-foreground">
                        Aucune tâche
                      </CardContent>
                    </Card>
                  ) : (
                    colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        member={
                          t.assignee_discord_id ? membersMap[t.assignee_discord_id] : null
                        }
                        onStatus={(s) => statusMut.mutate({ id: t.id, status: s })}
                        onDelete={() => deleteMut.mutate(t.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function TaskCard({
  task,
  member,
  onStatus,
  onDelete,
}: {
  task: Task;
  member: MemberLite | null;
  onStatus: (s: Task["status"]) => void;
  onDelete: () => void;
}) {
  const overdue =
    task.due_date && task.status !== "done" && task.status !== "cancelled"
      ? new Date(task.due_date) < new Date(new Date().toDateString())
      : false;
  const initial = (member?.ig_name ?? member?.discord_username ?? "?").slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium leading-snug">{task.title}</div>
          <Badge variant="outline" className={PRIORITY_STYLES[task.priority] ?? ""}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </Badge>
        </div>
        {task.description ? (
          <p className="text-xs text-muted-foreground">{task.description}</p>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {member ? (
              <>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={member.avatar_url ?? undefined} />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">
                  {member.ig_name ?? member.discord_username}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Non assigné</span>
            )}
          </div>
          {task.due_date ? (
            <span
              className={`flex items-center gap-1 ${
                overdue ? "text-red-400" : "text-muted-foreground"
              }`}
            >
              {overdue ? <AlertTriangle className="h-3 w-3" /> : null}
              {new Date(task.due_date).toLocaleDateString("fr-FR")}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Select value={task.status} onValueChange={(v) => onStatus(v as Task["status"])}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">À faire</SelectItem>
              <SelectItem value="doing">En cours</SelectItem>
              <SelectItem value="done">Fait</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
