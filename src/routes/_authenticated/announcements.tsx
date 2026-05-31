import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pin, PinOff, Plus, Pencil, Trash2, Check, Eye, Loader2 } from "lucide-react";
import { PageHeader, PageCard } from "@/components/tools/ToolsUi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { CardListSkeleton } from "@/components/Skeletons";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { toUserMessage } from "@/lib/errors";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPinned,
  acknowledgeAnnouncement,
  getAnnouncementReaders,
} from "@/lib/data/announcements.functions";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Annonces · PunkAstik" }] }),
  component: AnnouncementsPage,
});

type Ann = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  require_ack: boolean;
  created_at: string;
  created_by_username: string | null;
  readByMe: boolean;
  readsCount: number | null;
};

function AnnouncementsPage() {
  const { data: me } = useCurrentUser();
  const canManage = hasPerm(me, "members.edit");
  const qc = useQueryClient();

  const listFn = useServerFn(listAnnouncements);
  const ackFn = useServerFn(acknowledgeAnnouncement);
  const pinFn = useServerFn(toggleAnnouncementPinned);
  const delFn = useServerFn(deleteAnnouncement);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => listFn(),
  });

  const ackM = useMutation({
    mutationFn: (id: string) => ackFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements", "unread-count"] });
      toast.success("Annonce marquée comme lue");
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const pinM = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      pinFn({ data: { id, pinned } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (e) => toast.error(toUserMessage(e)),
  });
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Annonce supprimée");
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const [editing, setEditing] = useState<Ann | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [readersFor, setReadersFor] = useState<Ann | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const list = (data?.announcements ?? []) as Ann[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          code="// announces"
          title="Annonces"
          description="Communications internes, accusé de lecture requis."
        />
        {canManage && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="size-4 mr-1" /> Nouvelle annonce
          </Button>
        )}
      </div>


      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : list.length === 0 ? (
        <EmptyState title="Aucune annonce" description="Rien à signaler pour le moment." />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card
              key={a.id}
              className={
                a.pinned
                  ? "border-primary/40"
                  : a.require_ack && !a.readByMe
                  ? "border-amber-500/40"
                  : ""
              }
            >
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.pinned && (
                        <Badge variant="secondary" className="gap-1">
                          <Pin className="size-3" /> Épinglée
                        </Badge>
                      )}
                      {a.require_ack && !a.readByMe && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                          Non lue
                        </Badge>
                      )}
                      {a.require_ack && a.readByMe && (
                        <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-500/40">
                          <Check className="size-3" /> Lue
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold leading-tight">{a.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Par {a.created_by_username ?? "?"} ·{" "}
                      {new Date(a.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={a.pinned ? "Désépingler" : "Épingler"}
                        onClick={() => pinM.mutate({ id: a.id, pinned: !a.pinned })}
                      >
                        {a.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Éditer"
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Voir les lectures"
                        onClick={() => setReadersFor(a)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button size="icon" variant="ghost" title="Supprimer">
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title="Supprimer cette annonce ?"
                        description="Cette action est irréversible."
                        confirmLabel="Supprimer"
                        onConfirm={async () => {
                          await delM.mutateAsync(a.id);
                        }}

                      />

                    </div>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {canManage && a.readsCount !== null ? (
                    <span className="text-xs text-muted-foreground">
                      Lectures : {a.readsCount}
                    </span>
                  ) : (
                    <span />
                  )}
                  {a.require_ack && !a.readByMe && (
                    <Button
                      size="sm"
                      onClick={() => ackM.mutate(a.id)}
                      disabled={ackM.isPending}
                    >
                      {ackM.isPending && ackM.variables === a.id ? (
                        <Loader2 className="size-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="size-4 mr-1" />
                      )}
                      J'ai lu
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <AnnouncementEditor
          open={showCreate}
          onOpenChange={setShowCreate}
          onSaved={() => qc.invalidateQueries({ queryKey: ["announcements"] })}
        />
      )}
      {canManage && editing && (
        <AnnouncementEditor
          open
          onOpenChange={(o) => !o && setEditing(null)}
          announcement={editing}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["announcements"] });
            setEditing(null);
          }}
        />
      )}
      {readersFor && (
        <ReadersDialog
          announcement={readersFor}
          onClose={() => setReadersFor(null)}
        />
      )}
    </div>
  );
}

function AnnouncementEditor({
  open,
  onOpenChange,
  announcement,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  announcement?: Ann;
  onSaved: () => void;
}) {
  const createFn = useServerFn(createAnnouncement);
  const updateFn = useServerFn(updateAnnouncement);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [pinned, setPinned] = useState(announcement?.pinned ?? false);
  const [requireAck, setRequireAck] = useState(announcement?.require_ack ?? true);

  const m = useMutation({
    mutationFn: async () => {
      if (announcement) {
        return updateFn({
          data: { id: announcement.id, title, body, pinned, requireAck },
        });
      }
      return createFn({ data: { title, body, pinned, requireAck } });
    },
    onSuccess: () => {
      toast.success(announcement ? "Annonce mise à jour" : "Annonce publiée");
      onSaved();
      onOpenChange(false);
      if (!announcement) {
        setTitle("");
        setBody("");
        setPinned(false);
        setRequireAck(true);
      }
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement ? "Éditer l'annonce" : "Nouvelle annonce"}</DialogTitle>
          <DialogDescription>
            Sera diffusée dans le salon logs Discord à la création.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Titre</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Contenu</Label>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={5000}
            />
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={pinned} onCheckedChange={setPinned} />
              Épinglée
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={requireAck} onCheckedChange={setRequireAck} />
              Accusé de lecture requis
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || title.trim().length < 2 || body.trim().length < 2}
          >
            {m.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
            {announcement ? "Enregistrer" : "Publier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadersDialog({
  announcement,
  onClose,
}: {
  announcement: Ann;
  onClose: () => void;
}) {
  const readersFn = useServerFn(getAnnouncementReaders);
  const { data, isLoading } = useQuery({
    queryKey: ["announcement-readers", announcement.id],
    queryFn: () => readersFn({ data: { id: announcement.id } }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lectures — {announcement.title}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Chargement…"
              : `${data?.readers.length ?? 0} / ${data?.total ?? 0} membres actifs ont lu`}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <CardListSkeleton count={2} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section>
              <h4 className="text-sm font-medium mb-2 text-emerald-400">
                Lue ({data?.readers.length ?? 0})
              </h4>
              <ul className="space-y-1.5">
                {(data?.readers ?? []).map((r) => (
                  <li key={r.discord_id} className="flex items-center gap-2 text-sm">
                    <Avatar className="size-6">
                      {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                      <AvatarFallback>{(r.username ?? "?").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{r.username ?? r.discord_id}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(r.read_at).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                ))}
                {(data?.readers ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">Personne pour le moment</li>
                )}
              </ul>
            </section>
            <section>
              <h4 className="text-sm font-medium mb-2 text-amber-400">
                Non lue ({data?.unread.length ?? 0})
              </h4>
              <ul className="space-y-1.5">
                {(data?.unread ?? []).map((r) => (
                  <li key={r.discord_id} className="flex items-center gap-2 text-sm">
                    <Avatar className="size-6">
                      {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                      <AvatarFallback>{(r.username ?? "?").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{r.username ?? r.discord_id}</span>
                  </li>
                ))}
                {(data?.unread ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">Tout le monde a lu 🎉</li>
                )}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
