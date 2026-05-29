import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Plus, Trash2, Pencil, Copy, Check } from "lucide-react";
import {
  listBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  updateBlacklistEntry,
  type BlacklistRow,
} from "@/lib/data/blacklist.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RowListSkeleton as BlacklistRowsSkeleton } from "@/components/Skeletons";
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
            <BlacklistRowsSkeleton count={5} />
          ) : false ? (
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
function CopyableField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5 group">
        <span
          className={`text-sm break-all ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
          aria-label={`Copier ${label}`}
        >
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </button>
      </div>
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

  const headId = entry.mc_uuid || entry.mc_name;
  const avatarUrl = headId ? `https://mc-heads.net/avatar/${encodeURIComponent(headId)}/64` : null;
  const nameLookup = entry.mc_name ? `https://fr.namemc.com/search?q=${encodeURIComponent(entry.mc_name)}` : null;

  return (
    <li className="p-4 flex items-start gap-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={entry.mc_name ?? "skin"}
          className="size-12 rounded-md border border-border bg-muted shrink-0"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="size-12 rounded-md border border-border bg-muted shrink-0 flex items-center justify-center">
          <Ban className="size-5 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-3">
        <div className="grid gap-x-6 gap-y-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {entry.mc_name && (
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Pseudo MC</div>
              {nameLookup ? (
                <a
                  href={nameLookup}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-mono hover:underline break-all"
                >
                  {entry.mc_name}
                </a>
              ) : (
                <span className="text-sm font-mono break-all">{entry.mc_name}</span>
              )}
            </div>
          )}
          {entry.discord_id && <CopyableField label="Discord ID" value={entry.discord_id} />}
          {entry.mc_uuid && (
            <div className="sm:col-span-2 lg:col-span-1">
              <CopyableField label="UUID Minecraft" value={entry.mc_uuid} />
            </div>
          )}
        </div>

        {entry.reason && (
          <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
            « {entry.reason} »
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Ajouté par <span className="font-medium text-foreground/80">{entry.added_by_username ?? "?"}</span>
          {" · "}
          {new Date(entry.created_at).toLocaleDateString("fr-FR")}
          {entry.updated_at && entry.updated_at !== entry.created_at && (
            <> · modifié le {new Date(entry.updated_at).toLocaleDateString("fr-FR")}</>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <EditEntryDialog entry={entry} />
        <ConfirmDialog
          title="Supprimer cette entrée ?"
          description="Cette personne ne sera plus détectée comme blacklistée à la candidature."
          confirmLabel="Supprimer"
          onConfirm={async () => { await remove.mutateAsync(); }}
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
      </div>
    </li>
  );
}

function EditEntryDialog({ entry }: { entry: BlacklistRow }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateBlacklistEntry);
  const [open, setOpen] = useState(false);
  const [discordId, setDiscordId] = useState(entry.discord_id ?? "");
  const [mcName, setMcName] = useState(entry.mc_name ?? "");
  const [mcUuid, setMcUuid] = useState(entry.mc_uuid ?? "");
  const [reason, setReason] = useState(entry.reason ?? "");

  const update = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: entry.id,
          discordId: discordId.trim(),
          mcName: mcName.trim(),
          mcUuid: mcUuid.trim(),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Entrée mise à jour.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["blacklist"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = Boolean(discordId.trim() || mcName.trim() || mcUuid.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDiscordId(entry.discord_id ?? "");
          setMcName(entry.mc_name ?? "");
          setMcUuid(entry.mc_uuid ?? "");
          setReason(entry.reason ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Modifier">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l'entrée</DialogTitle>
          <DialogDescription>
            Au moins un identifiant doit rester renseigné.
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
            <label className="text-xs text-muted-foreground">UUID Minecraft</label>
            <Input value={mcUuid} onChange={(e) => setMcUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Motif</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de la blacklist…" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => update.mutate()} disabled={!canSubmit || update.isPending}>
            {update.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
