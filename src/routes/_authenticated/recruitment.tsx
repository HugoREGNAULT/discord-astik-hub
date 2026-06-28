import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  Loader2,
  Users,
  Ban,
  Sparkles,
  Star,
  FileEdit,
  AlertTriangle,
} from "lucide-react";
import { lazy, Suspense } from "react";
const RecruitmentTimelineChart = lazy(() => import("./-recruitment.chart"));
import { EmptyState } from "@/components/EmptyState";
import {
  listApplications,
  decideApplication,
  validateInterview,
  getApplicationStats,
} from "@/lib/data/applications.functions";
import {
  reviewApplication,
  getApplicationAiReview,
  type ApplicationAiReview,
} from "@/lib/data/applications-ai.functions";
import { listActiveDrafts, type ApplicationDraft } from "@/lib/data/application-drafts.functions";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Paginator, getPagedSlice } from "@/components/Paginator";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardListSkeleton } from "@/components/Skeletons";

const PER_PAGE = 15;
export const Route = createFileRoute("/_authenticated/recruitment")({
  component: () => (
    <Guard perm="recruit.access">
      <RecruitmentPage />
    </Guard>
  ),
});

type AppStatus = "pending" | "accepted" | "rejected" | "interview_validated";
type Tab = AppStatus | "drafts";

function RecruitmentPage() {
  const [tab, setTab] = useState<Tab>("pending");

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="// recruitment"
        title="Candidatures"
        description="Étape 1 : valider la candidature écrite (DM dispo entretien). Étape 2 : valider l'entretien (rôles finaux + essai 14j)."
      />

      <ApplicationStats />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="drafts">
            <FileEdit className="w-4 h-4 mr-1" /> En cours
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-1" /> En attente
          </TabsTrigger>
          <TabsTrigger value="accepted">
            <CheckCircle2 className="w-4 h-4 mr-1" /> À entretenir
          </TabsTrigger>
          <TabsTrigger value="interview_validated">
            <Sparkles className="w-4 h-4 mr-1" /> Entretien validé
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="w-4 h-4 mr-1" /> Refusées
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {tab === "drafts" ? <DraftsList /> : <ApplicationsList status={tab} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type BlacklistMatch = {
  id: string;
  matched_on: ("discord_id" | "mc_name" | "mc_uuid")[];
  discord_id: string | null;
  mc_name: string | null;
  reason: string;
  added_by_username: string | null;
  created_at: string;
};

type Application = {
  id: string;
  discord_id: string;
  discord_username: string;
  mc_name: string;
  presentation: string;
  presentation_gaming: string | null;
  age: number;
  country: string;
  schedule: string;
  objectives: string | null;
  motivation: string | null;
  additional_info: string | null;
  pvp_level: number | null;
  form_rating: number | null;
  heard_from: string;
  // Anciens champs (candidatures d'avant la refonte 2026-06).
  weekly_playtime?: string | null;
  first_version?: string | null;
  ig_grade?: string | null;
  previous_factions?: string | null;
  skills?: string | null;
  knowledge_level?: number | null;
  status: AppStatus;
  decided_by_username: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  interview_validated_at?: string | null;
  interview_validated_by_username?: string | null;
  created_at: string;
  blacklist_matches?: BlacklistMatch[];
};

function ApplicationsList({ status }: { status: AppStatus }) {
  const listFn = useServerFn(listApplications);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["applications", status],
    queryFn: () => listFn({ data: { status } }) as Promise<Application[]>,
  });

  const items = data ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const paged = getPagedSlice(items, page, PER_PAGE);

  if (isLoading) {
    return <CardListSkeleton count={4} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title={`Aucune candidature ${status === "pending" ? "en attente" : status}`}
        description="Les nouvelles candidatures s'afficheront ici dès leur réception."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="space-y-2">
        {paged.map((app) => (
          <AccordionItem key={app.id} value={app.id} className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 flex-1 text-left">
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(app.mc_name)}/32`}
                  alt=""
                  className="w-8 h-8 rounded-sm"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {app.mc_name}{" "}
                    <span className="text-muted-foreground text-xs">· @{app.discord_username}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {app.country} · {app.age} ans ·{" "}
                    {new Date(app.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                {app.blacklist_matches && app.blacklist_matches.length > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-2 bg-destructive/15 text-destructive border-destructive/40"
                  >
                    🚫 Blacklist
                  </Badge>
                )}
                {(app.pvp_level ?? app.knowledge_level) != null && (
                  <Badge variant="outline" className="ml-2">
                    PvP {app.pvp_level ?? app.knowledge_level}/10
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ApplicationDetail app={app} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

// --- Candidatures en cours (brouillons non soumis) ------------------------

/** Heuristique indicative de copier-coller / IA à partir des signaux de saisie. */
function pasteSuspicion(d: ApplicationDraft): {
  level: "none" | "watch" | "high";
  label: string;
} {
  const typedRatio = d.char_count > 0 ? d.keystroke_count / d.char_count : 1;
  const biggestPaste = d.paste_events.reduce((mx, e) => Math.max(mx, e.len), 0);
  if (biggestPaste >= 400 || (d.char_count >= 500 && typedRatio < 0.3)) {
    return { level: "high", label: "Collage massif" };
  }
  if (d.paste_total_chars >= 150 || (d.char_count >= 300 && typedRatio < 0.6)) {
    return { level: "watch", label: "À vérifier" };
  }
  return { level: "none", label: "" };
}

function DraftsList() {
  const listFn = useServerFn(listActiveDrafts);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["application-drafts"],
    queryFn: () => listFn() as Promise<ApplicationDraft[]>,
    refetchInterval: 30_000,
  });

  const items = data ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const paged = getPagedSlice(items, page, PER_PAGE);

  if (isLoading) return <CardListSkeleton count={3} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileEdit}
        title="Aucune candidature en cours"
        description="Les candidats qui ont commencé sans envoyer apparaîtront ici (rafraîchi automatiquement)."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Candidatures commencées mais non envoyées. Les signaux de collage / frappe sont indicatifs —
        un gros collage peut aussi être un texte rédigé ailleurs, pas forcément de l'IA.
      </p>
      <Accordion type="single" collapsible className="space-y-2">
        {paged.map((d) => {
          const susp = pasteSuspicion(d);
          return (
            <AccordionItem
              key={d.discord_id}
              value={d.discord_id}
              className="border rounded-lg bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 flex-1 text-left">
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(d.mc_name || "Steve")}/32`}
                    alt=""
                    className="w-8 h-8 rounded-sm"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {d.mc_name || "(pseudo non renseigné)"}{" "}
                      <span className="text-muted-foreground text-xs">
                        · @{d.discord_username ?? "?"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.char_count} car. · modifié {new Date(d.updated_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                  {susp.level !== "none" && (
                    <Badge
                      variant="outline"
                      className={
                        susp.level === "high"
                          ? "ml-2 bg-destructive/15 text-destructive border-destructive/40"
                          : "ml-2 bg-amber-500/15 text-amber-300 border-amber-500/40"
                      }
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" /> {susp.label}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <DraftDetail d={d} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

function DraftDetail({ d }: { d: ApplicationDraft }) {
  const minutes = Math.round(d.typing_ms / 60000);
  const typedRatio = d.char_count > 0 ? Math.round((d.keystroke_count / d.char_count) * 100) : 0;
  const biggest = d.paste_events.reduce((mx, e) => Math.max(mx, e.len), 0);
  return (
    <div className="space-y-4 pt-2 pb-1">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <Metric label="Collages" value={String(d.paste_count)} />
        <Metric label="Car. collés" value={String(d.paste_total_chars)} />
        <Metric label="Plus gros collage" value={`${biggest} car.`} />
        <Metric label="Frappes" value={String(d.keystroke_count)} />
        <Metric label="Frappes / caractère" value={`${typedRatio}%`} />
        <Metric label="Saisie active" value={minutes > 0 ? `${minutes} min` : "<1 min"} />
      </div>
      {d.paste_events.length > 0 && (
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Détail des {d.paste_events.length} collage(s)
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {d.paste_events.slice(-30).map((e, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {e.len} car.
              </Badge>
            ))}
          </div>
        </details>
      )}
      {d.heard_from && <Info label="Comment a découvert / qui l'a envoyé">{d.heard_from}</Info>}
      {d.presentation && <Info label="Présentation (IRL)">{d.presentation}</Info>}
      {d.presentation_gaming && (
        <Info label="Présentation (Minecraft / Paladium)">{d.presentation_gaming}</Info>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(d.age != null || d.country) && (
          <Info label="Âge / Pays">
            {(d.age ?? "?") + " ans"} · {d.country ?? "?"}
          </Info>
        )}
        {d.schedule && <Info label="Disponibilités">{d.schedule}</Info>}
      </div>
      {d.objectives && <Info label="Objectifs">{d.objectives}</Info>}
      {d.motivation && <Info label="Motivation">{d.motivation}</Info>}
      {d.additional_info && <Info label="Ajout libre">{d.additional_info}</Info>}
      {d.pvp_level != null && <Info label="Niveau PvP">{d.pvp_level}/10</Info>}
      <p className="text-[10px] text-muted-foreground italic">
        Candidature non envoyée — visible ici tant que le candidat ne l'a pas soumise.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function ApplicationDetail({ app }: { app: Application }) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideApplication);
  const validateFn = useServerFn(validateInterview);
  const [open, setOpen] = useState<"accept" | "reject" | "interview" | null>(null);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (decision: "accepted" | "rejected") =>
      decideFn({ data: { applicationId: app.id, decision, reason } }),
    onSuccess: (res) => {
      toast.success(
        `Candidature ${open === "accept" ? "validée (écrit)" : "refusée"}.${
          res.dmOk ? " DM Discord envoyé." : " (DM Discord échoué)"
        }`,
      );
      setOpen(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const interviewMutation = useMutation({
    mutationFn: () => validateFn({ data: { applicationId: app.id, reason } }),
    onSuccess: (res) => {
      if (res.roleWarnings && res.roleWarnings.length > 0) {
        toast.warning(
          `Entretien validé avec ${res.roleWarnings.length} alerte(s) rôle. ${res.roleWarnings[0]}`,
          { duration: 8000 },
        );
      } else {
        toast.success(
          `Entretien validé — essai 14j.${res.dmOk ? " DM Discord envoyé." : " (DM Discord échoué)"}`,
        );
      }
      setOpen(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-4 pt-2 pb-1">
      {app.blacklist_matches && app.blacklist_matches.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
          <div className="text-sm font-semibold text-destructive flex items-center gap-2">
            🚫 Correspondance(s) blacklist détectée(s)
          </div>
          {app.blacklist_matches.map((m) => (
            <div key={m.id} className="text-xs text-destructive/90 space-y-1">
              <div>
                <span className="font-mono">{m.matched_on.join(", ")}</span>
                {" — ajouté par "}
                <span className="font-medium">{m.added_by_username ?? "?"}</span>
                {" le "}
                {new Date(m.created_at).toLocaleDateString("fr-FR")}
              </div>
              {m.reason && <div className="italic">« {m.reason} »</div>}
            </div>
          ))}
        </div>
      )}
      <Info label="Comment a découvert / qui l'a envoyé">{app.heard_from}</Info>
      <Info label="Présentation (IRL)">{app.presentation}</Info>
      {app.presentation_gaming && (
        <Info label="Présentation (Minecraft / Paladium)">{app.presentation_gaming}</Info>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="Disponibilités">{app.schedule}</Info>
        {app.objectives && <Info label="Objectifs">{app.objectives}</Info>}
      </div>
      {app.motivation && <Info label="Motivation">{app.motivation}</Info>}
      {app.additional_info && <Info label="Ajout libre">{app.additional_info}</Info>}
      {app.form_rating != null && (
        <Info label="Note du formulaire (feedback candidat)">
          <StarsReadOnly value={app.form_rating} />
        </Info>
      )}
      {(app.weekly_playtime || app.first_version || app.skills || app.previous_factions) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/50 pt-3">
          {app.weekly_playtime && (
            <Info label="Temps de jeu / sem. (ancien)">{app.weekly_playtime}</Info>
          )}
          {app.first_version && <Info label="Première version (ancien)">{app.first_version}</Info>}
          {app.skills && <Info label="Compétences (ancien)">{app.skills}</Info>}
          {app.previous_factions && (
            <Info label="Anciennes factions (ancien)">{app.previous_factions}</Info>
          )}
        </div>
      )}

      <AiReview applicationId={app.id} />

      {app.status === "pending" ? (
        <div className="flex gap-2 pt-2">
          <Button onClick={() => setOpen("accept")} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Accepter (écrit)
          </Button>
          <Button variant="destructive" onClick={() => setOpen("reject")}>
            <XCircle className="w-4 h-4 mr-1" /> Refuser
          </Button>
        </div>
      ) : (
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs text-muted-foreground">
            {app.status === "accepted" && "✅ Acceptée à l'écrit — en attente d'entretien"}
            {app.status === "interview_validated" && "🎉 Entretien validé — membre en essai"}
            {app.status === "rejected" && "❌ Refusée"}
            {app.decided_by_username && (
              <>
                {" "}
                par <strong>{app.decided_by_username}</strong>
              </>
            )}
            {app.decided_at && <> le {new Date(app.decided_at).toLocaleDateString("fr-FR")}</>}
            {app.decision_reason && (
              <div className="mt-1 italic">Motif : {app.decision_reason}</div>
            )}
            {app.status === "interview_validated" && app.interview_validated_by_username && (
              <div className="mt-1">
                Entretien validé par <strong>{app.interview_validated_by_username}</strong>
                {app.interview_validated_at && (
                  <> le {new Date(app.interview_validated_at).toLocaleDateString("fr-FR")}</>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {app.status === "accepted" && (
              <Button
                size="sm"
                onClick={() => setOpen("interview")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Sparkles className="w-4 h-4 mr-1" /> Entretien validé
              </Button>
            )}
            {app.status === "rejected" && (
              <Button
                size="sm"
                onClick={() => setOpen("accept")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Finalement accepter (écrit)
              </Button>
            )}
            {app.status === "accepted" && (
              <Button size="sm" variant="destructive" onClick={() => setOpen("reject")}>
                <XCircle className="w-4 h-4 mr-1" /> Finalement refuser
              </Button>
            )}
          </div>
          {app.status === "accepted" && (
            <p className="text-[11px] text-muted-foreground italic">
              ⏳ Le candidat a reçu le rôle « attente entretien » et un DM pour donner ses dispos.
              Clique sur « Entretien validé » après l'entretien vocal pour le passer en essai 14j et
              lui attribuer les rôles finaux (public + privé).
            </p>
          )}
          {app.status === "interview_validated" && (
            <p className="text-[11px] text-muted-foreground italic">
              Le membre est en période d'essai. Si certains rôles privés n'ont pas pu être posés
              (personne pas encore sur le serveur faction), tu peux relancer « Entretien validé »
              une fois qu'elle a rejoint.
            </p>
          )}
          {app.status === "interview_validated" && (
            <div className="pt-1">
              <Button size="sm" variant="outline" onClick={() => setOpen("interview")}>
                <Sparkles className="w-4 h-4 mr-1" /> Relancer attribution des rôles
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "accept" && `Accepter la candidature écrite de ${app.mc_name} ?`}
              {open === "reject" && `Refuser ${app.mc_name} ?`}
              {open === "interview" && `Valider l'entretien de ${app.mc_name} ?`}
            </DialogTitle>
            <DialogDescription>
              {open === "accept" &&
                "Le candidat reçoit le rôle « attente entretien » et un DM pour donner ses dispos dans le salon prévu. Aucune fiche membre n'est créée à cette étape."}
              {open === "reject" && "Le candidat sera notifié du refus en DM Discord."}
              {open === "interview" &&
                "Le candidat passe en période d'essai 14j, rôles public + privé attribués, DM de bienvenue. Si la personne n'est pas encore sur le serveur privé, les rôles privés échoueront silencieusement — relance ce bouton plus tard."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              open === "interview"
                ? "Message de bienvenue (optionnel)"
                : open === "accept"
                  ? "Message ajouté au DM (optionnel)"
                  : "Motif du refus (optionnel)"
            }
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (open === "interview") interviewMutation.mutate();
                else mutation.mutate(open === "accept" ? "accepted" : "rejected");
              }}
              disabled={mutation.isPending || interviewMutation.isPending}
              className={
                open === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {(mutation.isPending || interviewMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}
      </div>
      <div className="text-sm whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function StarsReadOnly({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <span key={i} className="relative inline-block w-4 h-4">
              <Star className="w-4 h-4 text-muted-foreground/40" strokeWidth={1.5} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" strokeWidth={1.5} />
              </span>
            </span>
          );
        })}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{value}/5</span>
    </span>
  );
}

function AiReview({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewApplication);
  const getFn = useServerFn(getApplicationAiReview);

  const { data: review, isLoading } = useQuery({
    queryKey: ["application-ai", applicationId],
    queryFn: () => getFn({ data: { applicationId } }) as Promise<ApplicationAiReview | null>,
  });

  const mutation = useMutation({
    mutationFn: (force: boolean) => reviewFn({ data: { applicationId, force } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application-ai", applicationId] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const hasReview = !!review;
  const ai = review?.ai;
  const ev = review?.evidence;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Avis IA
          <span className="text-xs text-muted-foreground font-normal">
            · indicatif — la décision reste 100% humaine
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutation.mutate(hasReview)}
          disabled={mutation.isPending || isLoading}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          {hasReview ? "Régénérer" : "Générer l'avis"}
        </Button>
      </div>

      {isLoading && <div className="text-xs text-muted-foreground">Chargement de l'avis…</div>}

      {!isLoading && !hasReview && (
        <div className="text-xs text-muted-foreground">
          Aucun avis IA encore généré. Un job planifié génère automatiquement les avis manquants
          chaque 10 minutes — ou clique sur « Générer l'avis ».
        </div>
      )}

      {ai && (
        <div className="space-y-3 border-t border-primary/20 pt-3">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Score d'adéquation</span>
              <span className="font-semibold text-foreground">{ai.score}/100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-primary/10 overflow-hidden">
              <div
                className={`h-full ${
                  ai.score >= 70 ? "bg-emerald-500" : ai.score >= 40 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, ai.score))}%` }}
              />
            </div>
            <div className="mt-1 text-xs">
              Verdict :{" "}
              <Badge variant="outline" className="ml-1">
                {ai.fit === "plutot_oui"
                  ? "Plutôt OUI"
                  : ai.fit === "plutot_non"
                    ? "Plutôt NON"
                    : "À creuser"}
              </Badge>
            </div>
          </div>

          {ai.strengths.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-500 font-medium mb-1">
                Forces
              </div>
              <ul className="text-sm list-disc pl-5 space-y-0.5">
                {ai.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {ai.concerns.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-amber-500 font-medium mb-1">
                Points de vigilance
              </div>
              <ul className="text-sm list-disc pl-5 space-y-0.5">
                {ai.concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {ai.followup_questions && ai.followup_questions.length > 0 && (
            <div className="rounded-md border border-primary/30 bg-background/40 p-2">
              <div className="text-[11px] uppercase tracking-wider text-primary font-medium mb-1">
                Questions à poser en entretien
              </div>
              <ul className="text-sm list-decimal pl-5 space-y-1">
                {ai.followup_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {review?.ai_error && !ai && (
        <div className="text-xs text-destructive border-t border-destructive/20 pt-2">
          Synthèse IA indisponible : {review.ai_error}
        </div>
      )}

      {ev && (
        <div className="border-t border-primary/20 pt-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Profil joueur Paladium
          </div>
          <PaladiumProfilePanel
            mcUuid={ev.mc_uuid}
            mojangError={ev.mojang_error}
            paladiumError={ev.paladium_error}
            paladiumProfile={ev.paladium_profile}
            paladiumJobs={ev.paladium_jobs}
            onRefresh={() => mutation.mutate(true)}
            refreshing={mutation.isPending}
          />
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground pt-1">
            <span>
              <strong className="text-foreground">Blacklist :</strong> {ev.blacklist_matches.length}
            </span>
            <span>
              <strong className="text-foreground">Alts :</strong> {ev.alt_signals.length}
            </span>
          </div>
          <details className="text-[10px] text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">JSON brut</summary>
            <pre className="mt-1 max-h-64 overflow-auto rounded bg-background/50 p-2 leading-tight">
              {JSON.stringify(ev, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {review && (
        <div className="text-[10px] text-muted-foreground italic border-t border-primary/20 pt-2">
          Avis indicatif — la décision reste 100% humaine. Modèle : {review.model} ·{" "}
          {new Date(review.generated_at).toLocaleString("fr-FR")}
        </div>
      )}
    </div>
  );
}

function PaladiumProfilePanel({
  mcUuid,
  mojangError,
  paladiumError,
  paladiumProfile,
  paladiumJobs,
  onRefresh,
  refreshing,
}: {
  mcUuid: string | null;
  mojangError?: string;
  paladiumError?: string;
  paladiumProfile: unknown;
  paladiumJobs: unknown;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (!mcUuid) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200 flex items-center justify-between gap-2">
        <span>
          UUID Mojang non résolu — le pseudo n'existe pas ou Mojang est en erreur (
          {mojangError ?? "?"}).
        </span>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Réessayer"}
        </Button>
      </div>
    );
  }

  const hasProfile = !!paladiumProfile && typeof paladiumProfile === "object";
  const profile = hasProfile ? (paladiumProfile as Record<string, unknown>) : null;
  const jobs = Array.isArray(paladiumJobs)
    ? (paladiumJobs as Array<Record<string, unknown>>)
    : null;

  const pick = (...keys: string[]): string | number | null => {
    if (!profile) return null;
    for (const k of keys) {
      const v = profile[k];
      if (v != null && (typeof v === "string" || typeof v === "number")) return v;
    }
    return null;
  };

  const level = pick("level", "lvl");
  const xp = pick("xp", "experience");
  const money = pick("money", "balance", "coins");
  const faction = pick("factionName", "faction", "guild", "guildName");
  const rank = pick("rank", "grade");
  const playtime = pick("playtime", "timePlayed", "totalPlaytime");
  const firstSeen = pick("firstSeen", "firstJoin", "createdAt", "created_at");

  const formatFirstSeen = (v: string | number): { date: string; ago: string } | null => {
    const ts = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    const ms = ts < 1e12 ? ts * 1000 : ts;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    const ago =
      days < 30
        ? `${days}j`
        : days < 365
          ? `${Math.floor(days / 30)} mois`
          : `${(days / 365).toFixed(1)} ans`;
    return { date: d.toLocaleDateString("fr-FR"), ago };
  };
  const firstSeenFmt = firstSeen != null ? formatFirstSeen(firstSeen) : null;

  const formatPlaytime = (v: string | number): string => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) return String(v);
    const totalMin = Math.floor(n / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
  };

  return (
    <div className="space-y-2">
      {paladiumError && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span className="truncate">⚠️ API Paladium : {paladiumError.slice(0, 200)}</span>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Réessayer"}
          </Button>
        </div>
      )}

      {!hasProfile && !paladiumError && (
        <div className="text-xs text-muted-foreground italic">
          Aucune donnée Paladium pour ce joueur (jamais connecté sur le serveur ?).
        </div>
      )}

      {hasProfile && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {level != null && <PaladiumStat label="Niveau" value={String(level)} />}
          {xp != null && <PaladiumStat label="XP" value={String(xp)} />}
          {money != null && (
            <PaladiumStat
              label="Money"
              value={typeof money === "number" ? money.toLocaleString("fr-FR") : String(money)}
            />
          )}
          {faction != null && faction !== "" && (
            <PaladiumStat label="Faction IG" value={String(faction)} />
          )}
          {rank != null && <PaladiumStat label="Rang shop" value={String(rank)} />}
          {playtime != null && (
            <PaladiumStat label="Temps de jeu" value={formatPlaytime(playtime)} />
          )}
          {firstSeenFmt && (
            <PaladiumStat
              label="Première connexion"
              value={`${firstSeenFmt.date} (il y a ${firstSeenFmt.ago})`}
            />
          )}
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1 mt-2">
            Métiers ({jobs.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {jobs.slice(0, 12).map((j, i) => {
              const name = String(j.name ?? j.job ?? j.type ?? "?");
              const lvl = j.level ?? j.lvl ?? j.tier ?? null;
              return (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {name}
                  {lvl != null && (
                    <span className="ml-1 text-muted-foreground">lvl {String(lvl)}</span>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {hasProfile && (
        <div className="pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-7 text-xs"
          >
            {refreshing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : "🔄"} Rafraîchir
          </Button>
        </div>
      )}
    </div>
  );
}

function PaladiumStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className={`p-2 rounded-md ${tone ?? "bg-primary/10 text-primary"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

function ApplicationStats() {
  const statsFn = useServerFn(getApplicationStats);
  const { data } = useQuery({
    queryKey: ["applications", "stats"],
    queryFn: () => statsFn(),
  });

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Candidatures uniques" value={data.unique} />
        <StatCard
          icon={CheckCircle2}
          label="Acceptées"
          value={data.accepted}
          tone="bg-emerald-500/15 text-emerald-300"
        />
        <StatCard
          icon={XCircle}
          label="Refusées"
          value={data.rejected}
          tone="bg-red-500/15 text-red-300"
        />
        <StatCard
          icon={Ban}
          label="Blacklistées"
          value={data.blacklisted}
          tone="bg-primary/15 text-primary/70"
        />
      </div>
      {data.timeline.length > 1 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium mb-3">Évolution mensuelle</div>
          <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-md bg-muted" />}>
            <RecruitmentTimelineChart data={data.timeline} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
