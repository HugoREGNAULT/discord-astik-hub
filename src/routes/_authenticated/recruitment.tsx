import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, UserPlus, Loader2, Users, Ban, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { EmptyState } from "@/components/EmptyState";
import {
  listApplications,
  decideApplication,
  getApplicationStats,
} from "@/lib/data/applications.functions";
import { reviewApplication } from "@/lib/data/applications-ai.functions";

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

type AppStatus = "pending" | "accepted" | "rejected";

function RecruitmentPage() {
  const [tab, setTab] = useState<AppStatus>("pending");

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="// recruitment"
        title="Candidatures"
        description="Accepte ou refuse les candidatures à la PunkAstik. Les candidats sont notifiés en DM Discord."
      />

      <ApplicationStats />

      <Tabs value={tab} onValueChange={(v) => setTab(v as AppStatus)}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-1" /> En attente
          </TabsTrigger>
          <TabsTrigger value="accepted">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Acceptées
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
  const [open, setOpen] = useState<"accept" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (decision: "accepted" | "rejected") =>
      decideFn({ data: { applicationId: app.id, decision, reason } }),
    onSuccess: (res) => {
      toast.success(
        `Candidature ${open === "accept" ? "acceptée" : "refusée"}.${
          res.dmOk ? " DM Discord envoyé." : " (DM Discord échoué)"
        }`,
      );
      setOpen(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
            <CheckCircle2 className="w-4 h-4 mr-1" /> Accepter
          </Button>
          <Button variant="destructive" onClick={() => setOpen("reject")}>
            <XCircle className="w-4 h-4 mr-1" /> Refuser
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground border-t pt-3">
          {app.status === "accepted" ? "✅ Acceptée" : "❌ Refusée"}
          {app.decided_by_username && (
            <>
              {" "}
              par <strong>{app.decided_by_username}</strong>
            </>
          )}
          {app.decided_at && <> le {new Date(app.decided_at).toLocaleDateString("fr-FR")}</>}
          {app.decision_reason && <div className="mt-1 italic">Motif : {app.decision_reason}</div>}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "accept" ? "Accepter" : "Refuser"} {app.mc_name} ?
            </DialogTitle>
            <DialogDescription>
              {open === "accept"
                ? "Le candidat sera ajouté aux membres et notifié en DM Discord."
                : "Le candidat sera notifié du refus en DM Discord."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              open === "accept" ? "Message de bienvenue (optionnel)" : "Motif du refus (optionnel)"
            }
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => mutation.mutate(open === "accept" ? "accepted" : "rejected")}
              disabled={mutation.isPending}
              className={
                open === "accept"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
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
  const reviewFn = useServerFn(reviewApplication);
  const mutation = useMutation({
    mutationFn: () => reviewFn({ data: { applicationId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Avis IA
          <span className="text-xs text-muted-foreground font-normal">
            · récap + questions d'entretien
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          {mutation.data ? "Régénérer" : "Demander un avis"}
        </Button>
      </div>
      {mutation.data && (
        <div className="text-sm whitespace-pre-wrap leading-relaxed border-t border-primary/20 pt-3">
          {mutation.data.content}
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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#52525b" tick={{ fill: "#e4e4e7", fontSize: 12 }} />
                <YAxis
                  stroke="#52525b"
                  tick={{ fill: "#e4e4e7", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#e4e4e7",
                  }}
                  labelStyle={{ color: "#fafafa" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#e4e4e7" }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="accepted"
                  name="Acceptées"
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="rejected"
                  name="Refusées"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
