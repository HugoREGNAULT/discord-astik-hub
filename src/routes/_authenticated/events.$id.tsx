import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  ToolHeader,
  ToolCard,
  DaButton,
  DaInput,
  LoadingBlock,
  ErrorBlock,
} from "@/components/tools/ToolsUi";
import {
  getEvent,
  rsvpEvent,
  setAttendance,
  saveReport,
  distributeLoot,
  cancelEvent,
} from "@/lib/data/events.functions";
import { Textarea } from "@/components/ui/textarea";
import { toUserMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/events/$id")({
  head: () => ({ meta: [{ title: "Événement · PunkAstik" }] }),
  component: EventDetailPage,
  errorComponent: ({ error }) => <ErrorBlock message={toUserMessage(error)} />,
});

const RSVP_LABELS: Record<string, string> = {
  yes: "Présent",
  maybe: "Peut-être",
  no: "Absent",
};

function EventDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const getFn = useServerFn(getEvent);
  const rsvpFn = useServerFn(rsvpEvent);
  const attendFn = useServerFn(setAttendance);
  const reportFn = useServerFn(saveReport);
  const lootFn = useServerFn(distributeLoot);
  const cancelFn = useServerFn(cancelEvent);

  const evQ = useQuery({
    queryKey: ["event", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["event", id] });

  const rsvpMut = useMutation({
    mutationFn: (choice: "yes" | "maybe" | "no") =>
      rsvpFn({ data: { eventId: id, choice } }),
    onSuccess: () => {
      toast.success("RSVP enregistré");
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const [attendance, setAttendanceState] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState("");
  const [amount, setAmount] = useState<number>(100);

  useEffect(() => {
    if (!evQ.data) return;
    const init: Record<string, boolean> = {};
    for (const s of evQ.data.signups) init[s.member_discord_id] = !!s.attended;
    setAttendanceState(init);
    setReport(evQ.data.event.report ?? "");
  }, [evQ.data]);

  const attendMut = useMutation({
    mutationFn: () =>
      attendFn({
        data: {
          eventId: id,
          attendances: Object.entries(attendance).map(([memberDiscordId, attended]) => ({
            memberDiscordId,
            attended,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Présence enregistrée");
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const reportMut = useMutation({
    mutationFn: () => reportFn({ data: { eventId: id, report } }),
    onSuccess: () => {
      toast.success("Compte-rendu sauvegardé");
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const lootMut = useMutation({
    mutationFn: () =>
      lootFn({ data: { eventId: id, mode: "flat", amountPerMember: amount } }),
    onSuccess: (res) => {
      toast.success(`Butin distribué — ${res.total} pts à ${res.beneficiaries} membre(s)`);
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Événement annulé");
      invalidate();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (evQ.isLoading) return <LoadingBlock />;
  if (evQ.error) return <ErrorBlock message={toUserMessage(evQ.error)} />;
  if (!evQ.data) return null;

  const { event, signups, myDiscordId, canEdit } = evQ.data;
  const mySignup = signups.find((s: any) => s.member_discord_id === myDiscordId);
  const myChoice = mySignup?.rsvp as "yes" | "maybe" | "no" | undefined;
  const attendedCount = Object.values(attendance).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Link
        to="/events"
        className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-pink-500 uppercase tracking-[0.2em]"
      >
        <ArrowLeft className="size-3" /> Tous les événements
      </Link>

      <ToolHeader
        code={`// ${event.type}`}
        title={event.title}
        description={`${new Date(event.starts_at).toLocaleString("fr-FR")}${event.location ? ` · 📍 ${event.location}` : ""}`}
      />

      {event.description && (
        <ToolCard>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{event.description}</p>
        </ToolCard>
      )}

      {/* RSVP */}
      <section>
        <h2 className="text-sm uppercase tracking-[0.3em] text-pink-500 mb-3">
          // mon RSVP
        </h2>
        <ToolCard>
          {event.status !== "planned" ? (
            <p className="text-sm text-zinc-400">
              Les inscriptions sont fermées (statut : {event.status}).
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {(["yes", "maybe", "no"] as const).map((c) => (
                <DaButton
                  key={c}
                  variant={myChoice === c ? "primary" : "ghost"}
                  disabled={rsvpMut.isPending}
                  onClick={() => rsvpMut.mutate(c)}
                >
                  {RSVP_LABELS[c]}
                </DaButton>
              ))}
            </div>
          )}
        </ToolCard>
      </section>

      {/* Liste des inscrits — visible par tous */}
      <section>
        <h2 className="text-sm uppercase tracking-[0.3em] text-pink-500 mb-3">
          // inscrits ({signups.length})
        </h2>
        <ToolCard>
          {signups.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune inscription.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {signups.map((s: any) => (
                <div
                  key={s.id}
                  className="py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {canEdit && event.status !== "done" && (
                      <input
                        type="checkbox"
                        checked={!!attendance[s.member_discord_id]}
                        onChange={(e) =>
                          setAttendanceState({
                            ...attendance,
                            [s.member_discord_id]: e.target.checked,
                          })
                        }
                        className="accent-pink-500"
                      />
                    )}
                    <span className="text-white">
                      {s.member_username ?? s.member_discord_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-wider text-zinc-400">
                      {RSVP_LABELS[s.rsvp]}
                    </span>
                    {s.attended && (
                      <span className="text-[10px] uppercase text-emerald-400">
                        présent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canEdit && signups.length > 0 && event.status !== "done" && (
            <div className="mt-3 flex justify-end">
              <DaButton
                disabled={attendMut.isPending}
                onClick={() => attendMut.mutate()}
              >
                {attendMut.isPending ? "Enregistrement…" : "Enregistrer la présence"}
              </DaButton>
            </div>
          )}
        </ToolCard>
      </section>

      {/* Compte-rendu & butin — staff */}
      {canEdit && (
        <>
          <section>
            <h2 className="text-sm uppercase tracking-[0.3em] text-pink-500 mb-3">
              // compte-rendu
            </h2>
            <ToolCard>
              <Textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                rows={6}
                placeholder="Ce qu'il s'est passé, points marquants, KO/morts…"
              />
              <div className="mt-3 flex justify-end">
                <DaButton
                  disabled={reportMut.isPending}
                  onClick={() => reportMut.mutate()}
                >
                  Sauvegarder
                </DaButton>
              </div>
            </ToolCard>
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-[0.3em] text-pink-500 mb-3">
              // distribuer le butin
            </h2>
            <ToolCard>
              {event.loot_distributed ? (
                <p className="text-sm text-emerald-400">
                  Butin déjà distribué pour cet événement.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs uppercase tracking-wider text-zinc-400">
                      Montant / membre présent
                    </label>
                    <DaInput
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value) || 0)}
                      className="w-28"
                    />
                    <span className="text-xs text-zinc-500">pts</span>
                  </div>
                  <div className="text-sm text-zinc-300">
                    Aperçu : <span className="text-pink-500 font-bold">{amount}</span> ×{" "}
                    <span className="text-white">{attendedCount}</span> ={" "}
                    <span className="text-pink-500 font-bold">
                      {amount * attendedCount} pts
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <DaButton
                      variant="success"
                      disabled={
                        lootMut.isPending || amount < 1 || attendedCount === 0
                      }
                      onClick={() => lootMut.mutate()}
                    >
                      {lootMut.isPending ? "Distribution…" : "Distribuer"}
                    </DaButton>
                  </div>
                </div>
              )}
            </ToolCard>
          </section>

          {event.status !== "cancelled" && !event.loot_distributed && (
            <section>
              <DaButton
                variant="danger"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
              >
                Annuler l'événement
              </DaButton>
            </section>
          )}
        </>
      )}
    </div>
  );
}
