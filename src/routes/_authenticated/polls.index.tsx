import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Calendar, Lock, Trash2, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import { listPolls, createPoll, deletePoll } from "@/lib/data/polls.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { CardListSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { parsePollCsv } from "@/lib/csv/poll-csv";

export const Route = createFileRoute("/_authenticated/polls/")({
  head: () => ({ meta: [{ title: "Sondages · PunkAstik" }] }),
  component: PollsPage,
});

function PollsPage() {
  const { data: me } = useCurrentUser();
  const canManage = hasPerm(me, "members.edit");
  const qc = useQueryClient();
  const listFn = useServerFn(listPolls);
  const delFn = useServerFn(deletePoll);

  const { data, isLoading } = useQuery({
    queryKey: ["polls"],
    queryFn: () => listFn(),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { pollId: id } }),
    onSuccess: () => {
      toast.success("Sondage supprimé");
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sondages de planification</h1>
          <p className="text-sm text-muted-foreground">
            Vote sur les créneaux proposés pour les prochaines réunions / events.
          </p>
        </div>
        {canManage && (
          <CreatePollDialog onCreated={() => qc.invalidateQueries({ queryKey: ["polls"] })} />
        )}
      </div>

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : !data?.polls.length ? (
        <EmptyState
          icon={Calendar}
          title="Aucun sondage pour le moment"
          description={
            canManage
              ? "Crée le premier sondage avec le bouton ci-dessus."
              : "Reviens plus tard, les sondages apparaîtront ici."
          }
        />
      ) : (
        <div className="grid gap-3">
          {data.polls.map((p: any) => (
            <Card key={p.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-0 flex items-stretch gap-0">
                <Link
                  to="/polls/$id"
                  params={{ id: p.id }}
                  className="flex-1 min-w-0 flex items-center gap-4 py-4 pl-4 pr-2 rounded-l-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Ouvrir ${p.title}`}
                >
                  <Calendar className="size-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{p.title}</span>
                      {p.status === "open" ? (
                        <Badge variant="secondary">Ouvert</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="size-3" /> Clos
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Créé par {p.created_by_username ?? "—"} ·{" "}
                      {new Date(p.created_at).toLocaleDateString("fr-FR")}
                      {p.location && ` · 📍 ${p.location}`}
                    </div>
                  </div>
                </Link>
                <div
                  className="flex items-center gap-1 pr-2 py-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button asChild variant="ghost" size="sm" aria-label="Ouvrir">
                    <Link to="/polls/$id" params={{ id: p.id }}>
                      <ExternalLink className="size-4" />
                    </Link>
                  </Button>
                  {canManage && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" aria-label="Supprimer">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                      title={`Supprimer "${p.title}" ?`}
                      description="Ce sondage et tous les votes associés seront définitivement effacés."
                      confirmLabel="Supprimer"
                      onConfirm={async () => {
                        await mDel.mutateAsync(p.id);
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreatePollDialog({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(createPoll);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [slots, setSlots] = useState<{ value: string; duration: number }[]>([
    { value: "", duration: 60 },
    { value: "", duration: 60 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const opts = slots
      .filter((s) => s.value.trim().length > 0)
      .map((s) => ({ startsAt: s.value, durationMinutes: s.duration }));
    if (title.trim().length < 2) return toast.error("Titre trop court");
    if (opts.length < 2) return toast.error("Au moins 2 créneaux requis");
    setSubmitting(true);
    try {
      await createFn({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          options: opts,
        },
      });
      toast.success("Sondage créé");
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setSlots([
        { value: "", duration: 60 },
        { value: "", duration: 60 },
      ]);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nouveau sondage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau sondage de planification</DialogTitle>
          <DialogDescription>
            Propose plusieurs créneaux, les membres voteront oui / peut-être / non.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="poll-title">Titre *</Label>
            <Input
              id="poll-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Réunion staff de juin"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="poll-loc">Lieu (optionnel)</Label>
            <Input
              id="poll-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Salon vocal #staff"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="poll-desc">Description (optionnel)</Label>
            <Textarea
              id="poll-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Créneaux proposés</Label>
              <div>
                <input
                  id="poll-csv"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = String(reader.result ?? "");
                      const parsed = parsePollCsv(text);
                      const slots = parsed.slots.map((s) => ({
                        value: s.value,
                        duration: s.duration,
                      }));
                      if (!slots.length) {
                        toast.error("Aucun créneau valide trouvé dans le CSV");
                        return;
                      }
                      if (slots.length > 20) {
                        toast.error("Maximum 20 créneaux — seuls les 20 premiers ont été gardés");
                      }
                      setSlots(slots.slice(0, 20));
                      if (parsed.mode === "matrix") {
                        toast.success(
                          `${Math.min(slots.length, 20)} créneaux importés. Tu pourras importer les votes du CSV depuis la page du sondage après création.`,
                        );
                      } else {
                        toast.success(`${Math.min(slots.length, 20)} créneaux importés`);
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("poll-csv")?.click()}
                >
                  <Upload className="size-3" /> Importer CSV
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Accepte un CSV simple <code>date,durée(min)</code> ou un export Framadate/Google Forms
              (matrice <code>Nom,E-mail,créneau 1,créneau 2…</code>) — les votes pourront être
              importés ensuite depuis la page du sondage.
            </p>

            {slots.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  type="datetime-local"
                  value={s.value}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...next[i], value: e.target.value };
                    setSlots(next);
                  }}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={15}
                  max={1440}
                  step={15}
                  value={s.duration}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...next[i], duration: Number(e.target.value) || 60 };
                    setSlots(next);
                  }}
                  className="w-20"
                  title="Durée en minutes"
                />
                <span className="text-xs text-muted-foreground">min</span>
                {slots.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSlots([...slots, { value: "", duration: 60 }])}
              disabled={slots.length >= 20}
            >
              <Plus className="size-3" /> Ajouter un créneau
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
