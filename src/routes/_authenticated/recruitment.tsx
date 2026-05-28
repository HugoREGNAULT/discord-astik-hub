import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, UserPlus, Loader2 } from "lucide-react";
import {
  listApplications,
  decideApplication,
} from "@/lib/data/applications.functions";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/recruitment")({
  component: RecruitmentPage,
});

type AppStatus = "pending" | "accepted" | "rejected";

function RecruitmentPage() {
  const [tab, setTab] = useState<AppStatus>("pending");

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-primary" />
          Candidatures
        </h1>
        <p className="text-sm text-muted-foreground">
          Accepte ou refuse les candidatures à la PunkAstik. Les candidats sont
          notifiés en DM Discord.
        </p>
      </div>

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
};

function ApplicationsList({ status }: { status: AppStatus }) {
  const listFn = useServerFn(listApplications);
  const { data, isLoading } = useQuery({
    queryKey: ["applications", status],
    queryFn: () => listFn({ data: { status } }) as Promise<Application[]>,
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-12 border border-dashed rounded-lg">
        Aucune candidature {status === "pending" ? "en attente" : status}.
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-2">
      {data.map((app) => (
        <AccordionItem
          key={app.id}
          value={app.id}
          className="border rounded-lg bg-card px-4"
        >
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
                  <span className="text-muted-foreground text-xs">
                    · @{app.discord_username}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {app.country} · {app.age} ans · {app.ig_grade} ·{" "}
                  {new Date(app.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
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
      <Info label="Présentation">{app.presentation}</Info>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="Horaires">{app.schedule}</Info>
        <Info label="Temps de jeu / semaine">{app.weekly_playtime}</Info>
        <Info label="Première version">{app.first_version}</Info>
        <Info label="Comment a connu PunkAstik">{app.heard_from}</Info>
      </div>
      <Info label="Compétences">{app.skills}</Info>
      {app.previous_factions && (
        <Info label="Anciennes factions">{app.previous_factions}</Info>
      )}

      {app.status === "pending" ? (
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => setOpen("accept")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" /> Accepter
          </Button>
          <Button
            variant="destructive"
            onClick={() => setOpen("reject")}
          >
            <XCircle className="w-4 h-4 mr-1" /> Refuser
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground border-t pt-3">
          {app.status === "accepted" ? "✅ Acceptée" : "❌ Refusée"}
          {app.decided_by_username && <> par <strong>{app.decided_by_username}</strong></>}
          {app.decided_at && (
            <> le {new Date(app.decided_at).toLocaleDateString("fr-FR")}</>
          )}
          {app.decision_reason && (
            <div className="mt-1 italic">Motif : {app.decision_reason}</div>
          )}
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
              open === "accept"
                ? "Message de bienvenue (optionnel)"
                : "Motif du refus (optionnel)"
            }
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                mutation.mutate(open === "accept" ? "accepted" : "rejected")
              }
              disabled={mutation.isPending}
              className={
                open === "accept"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {mutation.isPending && (
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
