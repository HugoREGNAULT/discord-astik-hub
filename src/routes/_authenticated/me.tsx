import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MonoLabel } from "@/components/tools/ToolsUi";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Coins,
  Calendar,
  Award,
  MessageCircle,
  Mic,
  AlertTriangle,
  UserPlus,
  TrendingUp,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Gift,
  HandCoins,
  Gavel,
  UserCog,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MinecraftSkin } from "@/components/MinecraftSkin";
import { Paginator, getPagedSlice } from "@/components/Paginator";
import { getMyOverview, listMyWarnings, submitWarningAppeal, listMyOnboardingTasks, toggleMyOnboardingTask } from "@/lib/data/me.functions";
import { listMyBadges } from "@/lib/data/grades.functions";
import { deleteMyAccount } from "@/lib/data/account.functions";
import { ProfileHeroSkeleton, StatGridSkeleton, RowListSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Mon espace · PunkAstik" },
      {
        name: "description",
        content:
          "Ton profil PunkAstik : skin Minecraft, AstikPoints, grade et activité dans la faction.",
      },
    ],
  }),
  component: MePage,
});

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function daysSince(s: string | null | undefined) {
  if (!s) return null;
  const diff = Date.now() - new Date(s).getTime();
  return Math.floor(diff / 86_400_000);
}

function MePage() {
  const navigate = useNavigate();
  const getOverview = useServerFn(getMyOverview);
  const { data, isLoading } = useQuery({ queryKey: ["me-overview"], queryFn: () => getOverview() });

  useEffect(() => {
    if (data?.needsOnboarding) navigate({ to: "/welcome", replace: true });
  }, [data, navigate]);

  if (isLoading || !data || data.needsOnboarding) {
    return (
      <div className="space-y-6 max-w-6xl">
        <ProfileHeroSkeleton />
        <StatGridSkeleton count={4} cols={4} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent>
              <RowListSkeleton count={5} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full mt-3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const m = data.member;
  const voiceHours7d = Math.round((m.voice_7d_seconds ?? 0) / 360) / 10;
  const voiceHoursTotal = Math.round((m.voice_total_seconds ?? 0) / 360) / 10;
  const sinceArrival = daysSince(m.arrival_date);
  const sinceRankup = daysSince(m.last_rankup);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-6 flex flex-col md:flex-row gap-6 items-center md:items-start">
          <MinecraftSkin
            uuid={m.mc_uuid}
            username={m.ig_name}
            alt={`Skin de ${m.ig_name}`}
            className="h-48 md:h-64 w-auto object-contain drop-shadow-2xl"
          />
          <div className="flex-1 text-center md:text-left">
            <div className="text-pink-500">
              <MonoLabel>// profile</MonoLabel>
            </div>
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {m.ig_name}
            </h1>
            <p className="text-muted-foreground">@{m.discord_username ?? "—"}</p>
            <div className="flex gap-2 mt-3 justify-center md:justify-start flex-wrap">
              {m.current_grade && (
                <Badge variant="secondary" className="gap-1">
                  <Award className="size-3" /> {m.current_grade}
                </Badge>
              )}
              {m.status === "active" ? (
                <Badge className="bg-green-500/15 text-green-500 hover:bg-green-500/20">
                  Actif
                </Badge>
              ) : (
                <Badge variant="outline">Ancien</Badge>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground justify-center md:justify-start">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                <span>
                  Arrivé le{" "}
                  <span className="text-foreground font-medium">{formatDate(m.arrival_date)}</span>
                  {sinceArrival !== null && ` · ${sinceArrival}j`}
                </span>
              </div>
              {data.recruiter && (
                <div className="flex items-center gap-1.5">
                  <UserPlus className="size-4" />
                  <span>
                    Recruté par{" "}
                    <Link
                      to="/members/$id"
                      params={{ id: data.recruiter.discord_id }}
                      className="text-foreground font-medium hover:underline"
                    >
                      {data.recruiter.ig_name ?? data.recruiter.discord_username ?? "—"}
                    </Link>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Coins}
          label="AstikPoints"
          value={(m.astik_points ?? 0).toLocaleString("fr-FR")}
          accent="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Dernier rankup"
          value={sinceRankup !== null ? `il y a ${sinceRankup}j` : "—"}
          subtitle={formatDate(m.last_rankup)}
        />
        <StatCard
          icon={MessageCircle}
          label="Messages (7j)"
          value={(m.messages_7d ?? 0).toLocaleString("fr-FR")}
          subtitle={`${(m.messages_total ?? 0).toLocaleString("fr-FR")} au total`}
        />
        <StatCard
          icon={Mic}
          label="Vocal (7j)"
          value={`${voiceHours7d}h`}
          subtitle={`${voiceHoursTotal}h au total`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Timeline AstikPoints (paginée) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="size-4" /> Historique AstikPoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PointsTimeline gains={data.recentGains} />
          </CardContent>
        </Card>

        {/* Alts + warnings */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mes comptes alts</CardTitle>
            </CardHeader>
            <CardContent>
              {data.alts.length === 0 ? (
                <EmptyState
                  title="Aucun alt enregistré"
                  description="Ajoute tes comptes secondaires depuis l'onboarding."
                  variant="compact"
                />
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.alts.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span>{a.alt_name ?? "—"}</span>
                      <span className="text-muted-foreground text-xs font-mono">
                        {a.alt_discord_id ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/welcome">Modifier</Link>
              </Button>
            </CardContent>
          </Card>

          <MyTrialCard trialUntil={data.member.trial_until ?? null} />
          <MyBadgesCard />
          <MyWarningsCard />
        </div>
      </div>

      <DangerZone />
    </div>
  );
}

function MyBadgesCard() {
  const ls = useServerFn(listMyBadges);
  const { data } = useQuery({ queryKey: ["my-badges"], queryFn: () => ls() });
  const badges = (data?.badges ?? []) as Array<{
    badge_id: string;
    awarded_at: string;
    badges: { id: string; code: string; name: string; description: string | null; icon: string | null; color: string | null } | null;
  }>;
  if (badges.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Mes badges</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <span
            key={b.badge_id}
            title={b.badges?.description ?? b.badges?.name ?? ""}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border"
            style={{ borderColor: b.badges?.color ?? undefined, color: b.badges?.color ?? undefined }}
          >
            <span>{b.badges?.icon ?? "🏅"}</span>
            <span>{b.badges?.name ?? "Badge"}</span>
          </span>
        ))}
      </CardContent>
    </Card>
  );
}

function MyWarningsCard() {
  const qc = useQueryClient();
  const ls = useServerFn(listMyWarnings);
  const sub = useServerFn(submitWarningAppeal);
  const { data } = useQuery({ queryKey: ["my-warnings"], queryFn: () => ls() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const submit = useMutation({
    mutationFn: (warningId: string) => sub({ data: { warningId, message: msg.trim() } }),
    onSuccess: () => {
      toast.success("Appel envoyé");
      setOpenId(null);
      setMsg("");
      qc.invalidateQueries({ queryKey: ["my-warnings"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const list = data?.warnings ?? [];
  if (list.length === 0) return null;

  const sevColor: Record<string, string> = {
    verbal: "bg-muted text-foreground",
    minor: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    major: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    severe: "bg-destructive/15 text-destructive",
  };
  const statusLabel: Record<string, string> = {
    active: "Active",
    expired: "Expirée",
    revoked: "Annulée",
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" /> Mes sanctions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm">
          {list.map((w: any) => {
            const sev = w.severity ?? "minor";
            const expires = w.expires_at ? new Date(w.expires_at).toLocaleDateString("fr-FR") : null;
            const appeal = w.appeal;
            return (
              <li key={w.id} className="border-l-2 border-destructive/60 pl-3 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={sevColor[sev] ?? sevColor.minor} variant="outline">
                    {sev}
                  </Badge>
                  {w.category && (
                    <Badge variant="outline" className="text-xs">
                      {w.category}
                    </Badge>
                  )}
                  <Badge variant={w.status === "active" ? "destructive" : "secondary"}>
                    {statusLabel[w.status] ?? w.status}
                  </Badge>
                </div>
                <div>{w.body}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(w.created_at).toLocaleDateString("fr-FR")} · expire :{" "}
                  {expires ?? "permanent"}
                </div>
                {appeal && (
                  <div className="text-xs text-muted-foreground">
                    Appel :{" "}
                    <span className="font-medium">
                      {appeal.status === "pending"
                        ? "en attente"
                        : appeal.status === "accepted"
                          ? "accepté"
                          : "rejeté"}
                    </span>
                    {appeal.decision_note ? ` — ${appeal.decision_note}` : ""}
                  </div>
                )}
                {w.status === "active" && (!appeal || appeal.status !== "pending") && (
                  <AlertDialog
                    open={openId === w.id}
                    onOpenChange={(o) => {
                      setOpenId(o ? w.id : null);
                      if (!o) setMsg("");
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        Contester
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Contester cette sanction</AlertDialogTitle>
                        <AlertDialogDescription>
                          Explique au staff pourquoi tu contestes cet avertissement.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <textarea
                        className="w-full min-h-[120px] p-2 rounded-md border bg-background text-sm"
                        placeholder="Ton argumentaire (10 caractères min)"
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={msg.trim().length < 10 || submit.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            submit.mutate(w.id);
                          }}
                        >
                          Envoyer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteMyAccount);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  const mDel = useMutation({
    mutationFn: () => delFn({ data: { confirm: "SUPPRIMER" as const } }),
    onSuccess: () => {
      toast.success("Compte supprimé. Au revoir.");
      qc.clear();
      window.location.href = "/";
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <Trash2 className="size-4" /> Supprimer mon compte (RGPD)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Cette action efface tes alts, notes, warnings, candidatures et historique de points. Ta
          fiche membre est anonymisée et passée en « ancien ».
          <strong className="text-foreground"> Action irréversible.</strong>
        </p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="size-4 mr-1" /> Supprimer mes données
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Tape <code className="font-mono font-bold">SUPPRIMER</code> ci-dessous pour
                confirmer définitivement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-del">Confirmation</Label>
              <Input
                id="confirm-del"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="SUPPRIMER"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={mDel.isPending}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirm !== "SUPPRIMER" || mDel.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  mDel.mutate();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`size-4 ${accent ?? "text-muted-foreground"}`} />
        </div>
        <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

type Gain = {
  id: string;
  amount: number;
  reason: string | null;
  action_type: string;
  staff_username: string | null;
  created_at: string;
};

function actionIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("donation")) return Gift;
  if (t.includes("reward")) return ArrowUpCircle;
  if (t.includes("penalty") || t.includes("punish")) return Gavel;
  if (t.includes("manual") || t.includes("adjust")) return UserCog;
  if (t.includes("purchase") || t.includes("shop")) return HandCoins;
  if (t.includes("note")) return FileText;
  return MinusCircle;
}

function PointsTimeline({ gains }: { gains: Gain[] }) {
  const [page, setPage] = useState(1);
  const perPage = 10;
  const slice = getPagedSlice(gains, page, perPage);
  const pageCount = Math.ceil(gains.length / perPage);

  if (gains.length === 0) {
    return (
      <EmptyState
        title="Aucun mouvement récent"
        description="Ton historique de points apparaîtra ici."
        variant="compact"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative pl-6">
        {/* Ligne verticale */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        <ul className="space-y-5">
          {slice.map((g) => {
            const Icon = actionIcon(g.action_type);
            const isPositive = g.amount > 0;
            const isNegative = g.amount < 0;
            const dateStr = new Date(g.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            });
            const timeStr = new Date(g.created_at).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <li key={g.id} className="relative">
                {/* Point sur la timeline */}
                <div
                  className={`absolute -left-[17px] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background ${
                    isPositive
                      ? "border-green-500 text-green-500"
                      : isNegative
                        ? "border-destructive text-destructive"
                        : "border-muted-foreground text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3" />
                </div>

                {/* Contenu */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">
                      {g.reason ?? g.action_type}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground/80">{dateStr}</span>
                      {" · "}
                      {timeStr}
                      {g.staff_username && <span className="ml-1">· par {g.staff_username}</span>}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-mono font-semibold whitespace-nowrap ${
                      isPositive
                        ? "text-green-500"
                        : isNegative
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {g.amount >= 0 ? "+" : ""}
                    {g.amount.toLocaleString("fr-FR")} pts
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {pageCount > 1 && (
        <div className="pt-2">
          <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function MyTrialCard({ trialUntil }: { trialUntil: string | null }) {
  const qc = useQueryClient();
  const ls = useServerFn(listMyOnboardingTasks);
  const tg = useServerFn(toggleMyOnboardingTask);
  const { data } = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => ls(),
  });
  const toggle = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) => tg({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-onboarding"] }),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });
  const tasks = data?.tasks ?? [];
  if (!trialUntil && tasks.length === 0) return null;
  const daysLeft = trialUntil
    ? Math.ceil((new Date(trialUntil).getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Ma période d'essai
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {trialUntil && (
          <div className="text-sm">
            <span className="font-bold">{daysLeft}</span> jours restants
            <span className="text-muted-foreground text-xs ml-2">
              (jusqu'au {new Date(trialUntil).toLocaleDateString("fr-FR")})
            </span>
          </div>
        )}
        {tasks.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {tasks.map((t: any) => (
              <li key={t.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) =>
                    toggle.mutate({ id: t.id, done: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <span className={t.done ? "line-through text-muted-foreground" : ""}>
                  {t.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
