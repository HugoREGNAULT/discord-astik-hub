import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Plus, Trash2 } from "lucide-react";
import {
  listBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  type BlacklistRow,
} from "@/lib/data/blacklist.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/blacklist")({
  head: () => ({ meta: [{ title: "Blacklist · PunkAstik" }] }),
  component: () => (
    <Guard perm="recruit.access">
      <BlacklistPage />
    </Guard>
  ),
});

function BlacklistPage() {
  const listFn = useServerFn(listBlacklist);
  const { data, isLoading } = useQuery({
    queryKey: ["blacklist"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const entries = data?.entries ?? [];
  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return (
          e.discord_id?.toLowerCase().includes(q) ||
          e.mc_name?.toLowerCase().includes(q) ||
          e.mc_uuid?.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q)
        );
      })
    : entries;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="size-6 text-destructive" />
            Blacklist
          </h1>
          <p className="text-sm text-muted-foreground">
            Personnes interdites de candidature/recrutement. Détection automatique côté candidature.
          </p>
        </div>
        <AddEntryDialog />
      </div>

      <Input
        placeholder="Rechercher (Discord ID, pseudo MC, motif)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              {entries.length === 0 ? "Blacklist vide." : "Aucun résultat."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((entry) => (
                <BlacklistEntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BlacklistEntryRow({ entry }: { entry: BlacklistRow }) {
  const qc = useQueryClient();
  const removeFn = useServerFn(removeBlacklistEntry);
  const remove = useMutation({
    mutationFn: () => removeFn({ data: { id: entry.id } }),
    onSuccess: () => {
      toast.success("Entrée supprimée.");
      qc.invalidateQueries({ queryKey: ["blacklist"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <li className="p-4 flex items-start gap-3 flex-wrap">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap gap-2 items-center">
          {entry.mc_name && (
            <Badge variant="outline" className="font-mono">MC: {entry.mc_name}</Badge>
          )}
          {entry.discord_id && (
            <Badge variant="outline" className="font-mono">DC: {entry.discord_id}</Badge>
          )}
          {entry.mc_uuid && (
            <Badge variant="outline" className="font-mono text-xs">UUID: {entry.mc_uuid.slice(0, 8)}…</Badge>
          )}
        </div>
        {entry.reason && (
          <p className="text-sm text-muted-foreground italic">« {entry.reason} »</p>
        )}
        <p className="text-xs text-muted-foreground">
          Ajouté par <span className="font-medium">{entry.added_by_username ?? "?"}</span>
          {" · "}
          {new Date(entry.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>
      <ConfirmDialog
        title="Supprimer cette entrée ?"
        description="Cette personne ne sera plus détectée comme blacklistée à la candidature."
        confirmLabel="Supprimer"
        onConfirm={() => remove.mutateAsync()}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label="Supprimer"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
    </li>
  );
}

}

function AddEntryDialog() {
  const qc = useQueryClient();
  const addFn = useServerFn(addBlacklistEntry);
  const [open, setOpen] = useState(false);
  const [discordId, setDiscordId] = useState("");
  const [mcName, setMcName] = useState("");
  const [mcUuid, setMcUuid] = useState("");
  const [reason, setReason] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          discordId: discordId.trim() || undefined,
          mcName: mcName.trim() || undefined,
          mcUuid: mcUuid.trim() || undefined,
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Ajouté à la blacklist.");
      setOpen(false);
      setDiscordId("");
      setMcName("");
      setMcUuid("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["blacklist"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = Boolean(discordId.trim() || mcName.trim() || mcUuid.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-1" /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter à la blacklist</DialogTitle>
          <DialogDescription>
            Au moins un identifiant requis (Discord ID, pseudo MC ou UUID MC).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Discord ID</label>
            <Input value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="123456789012345678" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Pseudo Minecraft</label>
            <Input value={mcName} onChange={(e) => setMcName(e.target.value)} placeholder="Pseudo_IG" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">UUID Minecraft (optionnel)</label>
            <Input value={mcUuid} onChange={(e) => setMcUuid(e.target.value)} placeholder="xxxxxxxxxxxx…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Motif</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de la blacklist…" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => add.mutate()} disabled={!canSubmit || add.isPending}>
            {add.isPending ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
