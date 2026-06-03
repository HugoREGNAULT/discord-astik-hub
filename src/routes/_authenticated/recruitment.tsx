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

function RecruitmentPage() {
  const [tab, setTab] = useState<AppStatus>("pending");

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="// recruitment"
        title="Candidatures"
        description="Étape 1 : valider la candidature écrite (DM dispo entretien). Étape 2 : valider l'entretien (rôles finaux + essai 14j)."
      />

      <ApplicationStats />

      <Tabs value={tab} onValueChange={(v) => setTab(v as AppStatus)}>
        <TabsList>
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
          <ApplicationsList status={tab} />
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
  age: number;
  country: string;
  schedule: string;
  weekly_playtime: string;
  first_version: string;
  ig_grade: string;
  previous_factions: string | null;
  heard_from: string;
  skills: string;
  knowledge_level: number;
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
                    {app.country} · {app.age} ans · {app.ig_grade} ·{" "}
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
                <Badge variant="outline" className="ml-2">
                  {app.knowledge_level}/10
                </Badge>
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
      <Info label="Présentation">{app.presentation}</Info>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="Horaires">{app.schedule}</Info>
        <Info label="Temps de jeu / semaine">{app.weekly_playtime}</Info>
        <Info label="Première version">{app.first_version}</Info>
        <Info label="Comment a connu PunkAstik">{app.heard_from}</Info>
      </div>
      <Info label="Compétences">{app.skills}</Info>
      {app.previous_factions && <Info label="Anciennes factions">{app.previous_factions}</Info>}

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
              Clique sur « Entretien validé » après l'entretien vocal pour le passer en essai 14j
              et lui attribuer les rôles finaux (public + privé).
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

      {isLoading && (
        <div className="text-xs text-muted-foreground">Chargement de l'avis…</div>
      )}

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
                  ai.score >= 70
                    ? "bg-emerald-500"
                    : ai.score >= 40
                      ? "bg-amber-500"
                      : "bg-red-500"
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
        </div>
      )}

      {review?.ai_error && !ai && (
        <div className="text-xs text-destructive border-t border-destructive/20 pt-2">
          Synthèse IA indisponible : {review.ai_error}
        </div>
      )}

      {ev && (
        <details className="text-xs text-muted-foreground border-t border-primary/20 pt-2">
          <summary className="cursor-pointer hover:text-foreground">
            Sources brutes (profil Paladium, blacklist, alts)
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <span className="font-medium text-foreground">UUID Mojang :</span>{" "}
              {ev.mc_uuid ?? <em>non résolu</em>}
            </div>
            <div>
              <span className="font-medium text-foreground">Paladium :</span>{" "}
              {ev.paladium_error
                ? `indisponible (${ev.paladium_error.slice(0, 60)})`
                : ev.paladium_profile
                  ? "profil récupéré"
                  : "aucune donnée"}
            </div>
            <div>
              <span className="font-medium text-foreground">Blacklist :</span>{" "}
              {ev.blacklist_matches.length} match(s)
            </div>
            <div>
              <span className="font-medium text-foreground">Alts détectés :</span>{" "}
              {ev.alt_signals.length}
            </div>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-background/50 p-2 text-[10px] leading-tight">
              {JSON.stringify(ev, null, 2)}
            </pre>
          </div>
        </details>
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
          tone="bg-pink-500/15 text-pink-300"
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
