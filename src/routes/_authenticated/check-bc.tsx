import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Plus, Shield, Trash2, MapPin, Clock, Pencil } from "lucide-react";
import { ToolHeader, ToolCard, LoadingBlock, ErrorBlock } from "@/components/tools/ToolsUi";
import {
  listBcChecks,
  createBcCheck,
  updateBcCheck,
  deleteBcCheck,
  BC_STATUSES,
} from "@/lib/data/check-bc.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/check-bc")({
  head: () => ({
    meta: [
      { title: "Check BC · PunkAstik" },
      { name: "description", content: "Suivi collectif des BC (bases de coffres) repérées." },
    ],
  }),
  component: CheckBcPage,
});

type BcCheck = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  notes: string | null;
  created_by_username: string | null;
  updated_by_username: string | null;
  updated_at: string;
  created_at: string;
};

function statusColor(status: string) {
  const def = BC_STATUSES.find((s) => s.value === status);
  switch (def?.tone) {
    case "emerald":
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
    case "amber":
      return "border-amber-500/50 bg-amber-500/10 text-amber-300";
    case "pink":
      return "border-pink-500/60 bg-pink-500/10 text-pink-300";
    case "blurple":
      return "border-[#5865F2]/60 bg-[#5865F2]/10 text-indigo-300";
    default:
      return "border-zinc-700 bg-zinc-800/40 text-zinc-300";
  }
}

function statusLabel(status: string) {
  return BC_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function CheckBcPage() {
  const fn = useServerFn(listBcChecks);
  const q = useQuery({
    queryKey: ["bc-checks"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="max-w-5xl space-y-5">
      <ToolHeader
        code="// tools.check-bc"
        title="Check BC"
        description="Suivi collectif des BC repérées : statut en temps réel pour éviter les doublons et organiser les pillages."
      />

      <ToolCard>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Shield className="w-4 h-4 text-pink-500" />
            <span>{q.data?.checks.length ?? 0} BC en suivi</span>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Ajouter une BC
          </Button>
        </div>
      </ToolCard>

      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock message={(q.error as Error).message} />}

      {q.data && q.data.checks.length === 0 && (
        <ToolCard>
          <p className="text-sm text-zinc-400 text-center py-6">
            Aucune BC en suivi. Clique sur « Ajouter une BC » pour commencer.
          </p>
        </ToolCard>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(q.data?.checks ?? []).map((c) => (
          <BcRow key={c.id} bc={c as BcCheck} />
        ))}
      </div>

      <BcEditorDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
    </div>
  );
}

function BcRow({ bc }: { bc: BcCheck }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateBcCheck);
  const delFn = useServerFn(deleteBcCheck);
  const [editOpen, setEditOpen] = useState(false);

  const statusMut = useMutation({
    mutationFn: (status: string) => updFn({ data: { id: bc.id, status } }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["bc-checks"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const delMut = useMutation({
    mutationFn: () => delFn({ data: { id: bc.id } }),
    onSuccess: () => {
      toast.success("BC supprimée");
      qc.invalidateQueries({ queryKey: ["bc-checks"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-white font-semibold truncate">{bc.name}</div>
          {bc.location && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{bc.location}</span>
            </div>
          )}
        </div>
        <Badge
          variant="outline"
          className={`${statusColor(bc.status)} text-[10px] uppercase tracking-wider`}
        >
          {statusLabel(bc.status)}
        </Badge>
      </div>

      {bc.notes && (
        <p className="text-xs text-zinc-400 whitespace-pre-wrap line-clamp-3">{bc.notes}</p>
      )}

      <div className="flex items-center gap-2">
        <Select
          value={bc.status}
          onValueChange={(v) => statusMut.mutate(v)}
          disabled={statusMut.isPending}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BC_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <ConfirmDialog
          title={`Supprimer « ${bc.name} » ?`}
          description="Cette action est définitive."
          destructive
          confirmLabel="Supprimer"
          onConfirm={async () => {
            await delMut.mutateAsync();
          }}
          trigger={
            <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          }
        />
      </div>

      <div className="flex items-center gap-1 text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
        <Clock className="w-3 h-3" />
        <span>
          MAJ{" "}
          {new Date(bc.updated_at).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
          {bc.updated_by_username ? ` par ${bc.updated_by_username}` : ""}
        </span>
      </div>

      <BcEditorDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" bc={bc} />
    </div>
  );
}

function BcEditorDialog({
  open,
  onOpenChange,
  mode,
  bc,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  bc?: BcCheck;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createBcCheck);
  const updFn = useServerFn(updateBcCheck);

  const [name, setName] = useState(bc?.name ?? "");
  const [location, setLocation] = useState(bc?.location ?? "");
  const [status, setStatus] = useState(bc?.status ?? "libre");
  const [notes, setNotes] = useState(bc?.notes ?? "");

  // reset form when opening
  const reset = () => {
    setName(bc?.name ?? "");
    setLocation(bc?.location ?? "");
    setStatus(bc?.status ?? "libre");
    setNotes(bc?.notes ?? "");
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        return createFn({
          data: { name, location: location || null, status, notes: notes || null },
        });
      }
      return updFn({
        data: { id: bc!.id, name, location: location || null, status, notes: notes || null },
      });
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "BC ajoutée" : "BC mise à jour");
      qc.invalidateQueries({ queryKey: ["bc-checks"] });
      onOpenChange(false);
      if (mode === "create") {
        setName("");
        setLocation("");
        setStatus("libre");
        setNotes("");
      }
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Ajouter une BC" : "Modifier la BC"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nom de la BC *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: BC du nord, faction XYZ…"
              maxLength={200}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Localisation (coords / zone)</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: X=1200 Z=-340"
              maxLength={500}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Statut</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BC_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Infos utiles : protections, alts, horaires de présence…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || name.trim().length === 0}>
            {mut.isPending ? "Enregistrement…" : mode === "create" ? "Ajouter" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
