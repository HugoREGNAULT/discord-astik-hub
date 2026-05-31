import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Calendar, ExternalLink } from "lucide-react";
import {
  ToolHeader,
  ToolCard,
  DaButton,
  DaInput,
  DaSelect,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { listEvents, createEvent } from "@/lib/data/events.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import { toUserMessage } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({ meta: [{ title: "Événements · PunkAstik" }] }),
  component: EventsPage,
  errorComponent: ({ error }) => <ErrorBlock message={toUserMessage(error)} />,
});

const TYPE_LABELS: Record<string, string> = {
  raid: "Raid",
  defense: "Défense",
  training: "Entraînement",
  meeting: "Réunion",
  other: "Autre",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "text-emerald-400 border-emerald-400/40",
  locked: "text-amber-400 border-amber-400/40",
  done: "text-zinc-400 border-zinc-700",
  cancelled: "text-red-400 border-red-400/40",
};

function EventsPage() {
  const { data: me } = useCurrentUser();
  const canManage = hasPerm(me, "members.edit");
  const qc = useQueryClient();
  const listFn = useServerFn(listEvents);
  const createFn = useServerFn(createEvent);

  const eventsQ = useQuery({
    queryKey: ["events"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "raid",
    description: "",
    location: "",
    startsAt: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title: form.title,
          type: form.type as "raid" | "defense" | "training" | "meeting" | "other",
          description: form.description || null,
          location: form.location || null,
          startsAt: form.startsAt,
        },
      }),
    onSuccess: () => {
      toast.success("Événement créé");
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      setForm({ title: "", type: "raid", description: "", location: "", startsAt: "" });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-6">
      <ToolHeader
        code="// events"
        title="Événements faction"
        description="Raids, défenses et briefings. Inscris-toi pour qu'on sache qui sera là."
        right={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <DaButton>
                  <Plus className="size-4" /> Créer
                </DaButton>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvel événement</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Titre</Label>
                    <DaInput
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <DaSelect
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </DaSelect>
                  </div>
                  <div>
                    <Label>Date & heure</Label>
                    <DaInput
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Lieu</Label>
                    <DaInput
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DaButton
                    disabled={!form.title || !form.startsAt || createMut.isPending}
                    onClick={() => createMut.mutate()}
                  >
                    {createMut.isPending ? "Création…" : "Créer"}
                  </DaButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {eventsQ.isLoading ? (
        <LoadingBlock />
      ) : eventsQ.error ? (
        <ErrorBlock message={toUserMessage(eventsQ.error)} />
      ) : (eventsQ.data?.events ?? []).length === 0 ? (
        <EmptyBlock label="Aucun événement pour le moment." />
      ) : (
        <div className="grid gap-3">
          {eventsQ.data!.events.map((ev: any) => (
            <ToolCard key={ev.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                      {TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                    <span
                      className={`border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        STATUS_COLORS[ev.status] ?? "text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {ev.status}
                    </span>
                    {ev.loot_distributed && (
                      <span className="border border-pink-500/40 text-pink-500 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        butin OK
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white mt-1 truncate">{ev.title}</h3>
                  <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                    <Calendar className="size-3" />
                    {new Date(ev.starts_at).toLocaleString("fr-FR")}
                    {ev.location && <span>• 📍 {ev.location}</span>}
                  </div>
                </div>
                <Link to="/events/$id" params={{ id: ev.id }}>
                  <DaButton variant="ghost">
                    <ExternalLink className="size-4" />
                  </DaButton>
                </Link>
              </div>
            </ToolCard>
          ))}
        </div>
      )}
    </div>
  );
}
