import { createLazyFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Paginator, getPagedSlice } from "@/components/Paginator";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  getChurnRisk,
  getRetentionCohorts,
  type ChurnRow,
  type CohortRow,
} from "@/lib/data/churn.functions";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShoppingCart,
  AlertTriangle,
  ShieldAlert,
  Coins,
  Activity,
  Clock,
  TrendingUp,
  MessageCircle,
  UserMinus,
  Sparkles,
  HeartPulse,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Send,
  Megaphone,
  Download,
  History,
  TrendingUp as TrendingUpIcon,
  UserPlus as UserPlusIcon,
  ShieldAlert as ShieldAlertIcon,
  Activity as ActivityIcon,
  ShoppingCart as ShoppingCartIcon,
} from "lucide-react";

import { Guard } from "@/components/Guard";
import {
  getStaffDashboard,
  getInactivityBuckets,
  getNeverConnectedMembers,
  getMembersWithoutMc,
  setMemberMcByStaff,
} from "@/lib/data/staff.functions";
import { getInactivityQueue, sendInactivityPing } from "@/lib/data/inactivity.functions";
import {
  getOpenAnomalies,
  updateAnomalyStatus,
  type OpenAnomalyRow,
} from "@/lib/data/anomaly.functions";
import { getFactionHealth } from "@/lib/data/health.functions";
import { getLatestDigest, generateDigestManually } from "@/lib/data/digest.functions";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { lazy, Suspense } from "react";
const StaffHealthChart = lazy(() => import("./-staff.chart"));

import { markMemberAway, dmMember } from "@/lib/data/members.functions";
import {
  listOpenPollsForDm,
  listFactionRoles,
  previewDmAudience,
  sendBulkDm,
  exportDmAudience,
  listBulkDmHistory,
  type DmAudience,
} from "@/lib/data/bulk-dm.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { KpiGridSkeleton, RowListSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { LazyApplicationsChart as ApplicationsChart } from "@/components/LazyApplicationsChart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { StaffPresence } from "@/components/StaffPresence";

export const Route = createLazyFileRoute("/_authenticated/staff")({
  component: () => (
    <Guard perm="members.view">
      <StaffPage />
    </Guard>
  ),
});

function StaffPage() {
  const fn = useServerFn(getStaffDashboard);
  const { data: me } = useCurrentUser();
  const { data, isLoading } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: () => fn(),
  });

  // Realtime — invalide les caches dépendant des tables applications/donations/warnings.
  // Le push ne sert qu'à invalider : aucune donnée sensible ne transite côté client.
  const invalidatedKeys = [["staff-dashboard"], ["faction-health"]];
  useRealtimeChannel("applications", "*", invalidatedKeys);
  useRealtimeChannel("donations", "*", invalidatedKeys);
  useRealtimeChannel("warnings", "*", invalidatedKeys);

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <KpiGridSkeleton count={5} />
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <RowListSkeleton count={4} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          code="// staff"
          title="Dashboard staff"
          description="Vue d'ensemble de la faction : alertes, files d'attente et activité récente."
        />
        {me ? (
          <StaffPresence
            discordId={me.discordId}
            username={me.username}
            avatar={me.avatarUrl ?? me.avatar ?? null}
          />
        ) : null}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={<Users className="size-4" />}
          label="Membres actifs"
          value={k.activeMembers}
          sub={`${k.formerMembers} anciens`}
        />
        <KpiCard
          icon={<UserPlus className="size-4" />}
          label="Candidatures en attente"
          value={k.pendingApplications}
          accent={k.pendingApplications > 0 ? "pink" : undefined}
          href="/recruitment"
        />
        <KpiCard
          icon={<ShoppingCart className="size-4" />}
          label="Paniers actifs"
          value={k.activeDonations}
          accent={k.activeDonations > 0 ? "blurple" : undefined}
          href="/donations"
        />
        <KpiCard
          icon={<AlertTriangle className="size-4" />}
          label="Inactifs 7j"
          value={k.inactiveCount}
          accent={k.inactiveCount > 0 ? "pink" : undefined}
          sub="0 msg & 0 vocal"
        />
        <KpiCard
          icon={<ShieldAlert className="size-4" />}
          label="Warnings 7j"
          value={data.recentWarnings.length}
          accent={data.recentWarnings.length > 0 ? "pink" : undefined}
        />
      </div>

      {/* Santé faction */}
      <FactionHealthSection />

      {/* Digest IA hebdo */}
      <WeeklyDigestSection />

      {/* Communication staff (DM massif) */}
      <BulkDmCard />

      {/* Anomalies à examiner (détection stat. + explication IA, décision humaine) */}
      <AnomaliesCard />

      {/* Risque de départ + cohortes de rétention */}
      <ChurnSection />

      {/* Applications timeline + global stats */}
      <ApplicationsTimelineCard
        timeline={data.applicationsTimeline ?? []}
        stats={data.applicationsStats ?? { total: 0, accepted: 0, rejected: 0, acceptanceRate: 0 }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Candidatures en attente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="size-4 text-primary" />
                Candidatures à traiter
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/recruitment">Voir tout</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentApplications.length === 0 ? (
              <EmptyState
                icon={UserPlusIcon}
                title="Aucune candidature en attente"
                description="Boîte vide, tout est traité."
                variant="compact"
              />
            ) : (
              data.recentApplications.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border border-border rounded p-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.mc_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      @{a.discord_username} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Warnings récents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" />
              Warnings récents (7j)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {data.recentWarnings.length === 0 ? (
              <EmptyState
                icon={ShieldAlertIcon}
                title="Aucun avertissement"
                description="Aucune sanction sur les 7 derniers jours."
                variant="compact"
              />
            ) : (
              data.recentWarnings.map((w: any) => (
                <Link
                  key={w.id}
                  to="/members/$id"
                  params={{ id: w.member_discord_id }}
                  className="block border border-destructive/40 bg-destructive/5 rounded p-2 text-sm hover:bg-destructive/10 transition"
                >
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(w.created_at).toLocaleString("fr-FR")} · {w.staff_username ?? "?"} →{" "}
                    {w.member_discord_id}
                  </div>
                  <div className="line-clamp-2 mt-0.5">{w.body}</div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activité staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Activité staff (15 dernières actions)
            </span>
            <Button asChild size="sm" variant="outline">
              <Link to="/logs">Historique complet</Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.staffActivity.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="Aucune action récente"
              description="L'activité staff apparaîtra ici dès qu'une action est effectuée."
              variant="compact"
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.staffActivity.map((l: any) => (
                <li key={l.id} className="py-2 text-sm flex items-start gap-2">
                  <Clock className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono">{l.action}</code>
                      {l.actor_discord_id && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          par {l.actor_discord_id}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(l.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    {l.payload && Object.keys(l.payload).length > 0 && (
                      <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {JSON.stringify(l.payload)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent donations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" />
              Derniers paniers
            </span>
            <Button asChild size="sm" variant="outline">
              <Link to="/points">Gérer</Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentDonations.length === 0 ? (
            <EmptyState
              icon={ShoppingCartIcon}
              title="Aucun panier récent"
              description="Les paniers validés s'afficheront ici."
              variant="compact"
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentDonations.map((d: any) => (
                <li key={d.id} className="py-2 text-sm flex items-center gap-3">
                  <Badge
                    variant={
                      d.status === "validated"
                        ? "secondary"
                        : d.status === "active"
                          ? "default"
                          : "outline"
                    }
                  >
                    {d.status}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {d.member_discord_id ?? "—"}
                  </span>
                  <span className="ml-auto flex items-center gap-1 font-semibold">
                    <Coins className="size-3 text-primary" /> {d.total_final}
                  </span>
                  <span className="text-[11px] text-muted-foreground w-32 text-right">
                    {new Date(d.created_at).toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* File de relance d'inactivité */}
      <InactivityQueueCard />

      {/* Membres jamais connectés au site */}
      <NeverConnectedCard />

      {/* Membres sans pseudo Minecraft lié */}
      <MissingMcCard />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: "pink" | "blurple";
  href?: string;
}) {
  const accentClass =
    accent === "pink"
      ? "border-primary/50 bg-primary/5"
      : accent === "blurple"
        ? "border-primary/50 bg-primary/5"
        : "";

  const body = (
    <Card className={`${accentClass} transition hover:border-primary/40`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );

  return href ? <Link to={href}>{body}</Link> : body;
}

function InactiveMemberRow({
  member,
}: {
  member: {
    discord_id: string;
    ig_name?: string | null;
    discord_username?: string | null;
    current_grade?: string | null;
    avatar_url?: string | null;
  };
}) {
  const qc = useQueryClient();
  const awayFn = useServerFn(markMemberAway);
  const dmFn = useServerFn(dmMember);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmContent, setDmContent] = useState(
    `Yo ${member.ig_name ?? member.discord_username ?? ""} 👋\n\nApparemment tu serais absent ? Si c'est le cas, merci de poser une absence ici : https://punkastik.com/absences\n\nSinon on risque de te sanctionner sans savoir que tu étais absent. Donne-nous des nouvelles 🙏`,
  );

  const awayMut = useMutation({
    mutationFn: () => awayFn({ data: { memberDiscordId: member.discord_id } }),
    onSuccess: () => {
      toast.success("Membre marqué en absence");
      qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const dmMut = useMutation({
    mutationFn: () => dmFn({ data: { memberDiscordId: member.discord_id, content: dmContent } }),
    onSuccess: () => {
      toast.success("DM envoyé");
      setDmOpen(false);
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="flex items-center gap-2 border border-border rounded p-2 hover:border-primary/40 transition">
      <Link
        to="/members/$id"
        params={{ id: member.discord_id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="size-8 rounded-full" />
        ) : (
          <div className="size-8 rounded-full bg-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {member.ig_name ?? member.discord_username}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            @{member.discord_username ?? "—"} · {member.current_grade ?? "—"}
          </div>
        </div>
      </Link>
      <div className="flex gap-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDmOpen(true)}
          title="Contacter le membre par DM Discord"
        >
          <MessageCircle className="size-3.5" />
        </Button>
        <ConfirmDialog
          title={`Marquer ${member.ig_name ?? member.discord_username} en absence ?`}
          description="Le statut du membre passera à 'absent'."
          confirmLabel="Marquer absent"
          destructive={false}
          onConfirm={async () => {
            await awayMut.mutateAsync();
          }}
          trigger={
            <Button
              size="sm"
              variant="outline"
              disabled={awayMut.isPending}
              title="Marquer en absence"
            >
              <UserMinus className="size-3.5" />
            </Button>
          }
        />
      </div>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contacter {member.ig_name ?? member.discord_username}</DialogTitle>
            <DialogDescription>
              Le message sera envoyé en DM Discord depuis le bot de la faction.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={dmContent}
            onChange={(e) => setDmContent(e.target.value)}
            rows={6}
            maxLength={1800}
          />
          <div className="text-[11px] text-muted-foreground text-right">
            {dmContent.length}/1800
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDmOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => dmMut.mutate()}
              disabled={dmMut.isPending || dmContent.trim().length === 0}
            >
              {dmMut.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationsTimelineCard({
  timeline,
  stats,
}: {
  timeline: { date: string; created: number; accepted: number; rejected: number }[];
  stats: { total: number; accepted: number; rejected: number; acceptanceRate: number };
}) {
  const [range, setRange] = useState<30 | 90>(30);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-3">
          <span className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Évolution des candidatures
          </span>
          <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as 30 | 90)}>
            <TabsList>
              <TabsTrigger value="30">30j</TabsTrigger>
              <TabsTrigger value="90">90j</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="Acceptées" value={stats.accepted} tone="green" />
          <MiniStat label="Refusées" value={stats.rejected} tone="red" />
          <MiniStat label="Taux d'acceptation" value={`${stats.acceptanceRate}%`} tone="primary" />
        </div>
        <ApplicationsChart data={timeline} range={range} />
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "green" | "red" | "primary";
}) {
  const color =
    tone === "green"
      ? "text-green-500"
      : tone === "red"
        ? "text-red-500"
        : tone === "primary"
          ? "text-primary"
          : "";
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// ----------------- Santé faction -----------------

function FactionHealthSection() {
  const fn = useServerFn(getFactionHealth);
  const { data, isLoading } = useQuery({
    queryKey: ["faction-health"],
    queryFn: () => fn(),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4 text-primary" /> Santé faction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const s = data.summary;
  const netPositive = s.netGrowth30 >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="size-4 text-primary" />
          Santé faction
          <span className="text-[11px] text-muted-foreground font-normal ml-auto">
            30/90 derniers jours
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthStat
            label="Taux d'activité 7j"
            value={`${s.activityRate}%`}
            sub={`${s.activeMembers} actifs`}
            tone={s.activityRate >= 70 ? "green" : s.activityRate >= 40 ? "amber" : "red"}
          />
          <HealthStat
            label="Arrivées 30j"
            value={`+${s.arrivals30}`}
            tone="green"
            icon={<ArrowUpRight className="size-3.5" />}
          />
          <HealthStat
            label="Départs 30j"
            value={`-${s.departures30}`}
            tone={s.departures30 > s.arrivals30 ? "red" : undefined}
            icon={<ArrowDownRight className="size-3.5" />}
          />
          <HealthStat
            label="Solde net"
            value={`${netPositive ? "+" : ""}${s.netGrowth30}`}
            sub={`Turnover ${s.turnoverRate}%`}
            tone={netPositive ? "green" : "red"}
          />
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Évolution effectif · inactifs · absents (90 jours)
          </div>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-muted" />}>
            <StaffHealthChart evolution={data.evolution} />
          </Suspense>
        </div>

        {data.topRecruiters.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Top recruteurs (90j)
            </div>
            <ul className="grid sm:grid-cols-2 gap-2">
              {data.topRecruiters.map((r: any, i: number) => (
                <Link
                  key={r.discord_id}
                  to="/members/$id"
                  params={{ id: r.discord_id }}
                  className="flex items-center gap-3 border border-border rounded p-2 text-sm hover:border-primary/40 transition"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="size-7 rounded-full" />
                  ) : (
                    <div className="size-7 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0 truncate">
                    {r.ig_name ?? r.discord_username ?? r.discord_id}
                  </div>
                  <Badge variant="secondary">{r.count_90d} recrut.</Badge>
                  {r.count_30d > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{r.count_30d} 30j
                    </Badge>
                  )}
                </Link>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthStat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "green" | "red" | "amber";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "green"
      ? "text-emerald-400"
      : tone === "red"
        ? "text-red-400"
        : tone === "amber"
          ? "text-amber-400"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ----------------- Digest IA hebdo -----------------

function WeeklyDigestSection() {
  const fn = useServerFn(getLatestDigest);
  const genFn = useServerFn(generateDigestManually);
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const canGenerate = hasPerm(me, "admin.access");

  const { data, isLoading } = useQuery({
    queryKey: ["latest-digest"],
    queryFn: () => fn(),
  });

  const genMut = useMutation({
    mutationFn: () => genFn(),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success(res.reused ? "Digest déjà à jour" : "Digest généré ✨");
        qc.invalidateQueries({ queryKey: ["latest-digest"] });
      } else {
        toast.error(res?.error ?? "Échec de la génération");
      }
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const digest = data?.digest;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Digest IA hebdomadaire
          <span className="text-[11px] text-muted-foreground font-normal ml-2">
            Généré chaque lundi 10h
          </span>
          {canGenerate && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5"
              disabled={genMut.isPending}
              onClick={() => genMut.mutate()}
              title="Régénérer le digest de la semaine en cours"
            >
              <RefreshCw className={`size-3.5 ${genMut.isPending ? "animate-spin" : ""}`} />
              {genMut.isPending ? "Génération…" : "Regénérer"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !digest ? (
          <EmptyState
            icon={Sparkles}
            title="Aucun digest pour l'instant"
            description={
              canGenerate
                ? "Clique sur Regénérer pour produire le premier résumé IA."
                : "Le premier résumé sera généré automatiquement lundi prochain à 10h."
            }
            variant="compact"
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline">
                Semaine du{" "}
                {new Date(digest.week_start).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </Badge>
              <span>
                · Généré {new Date(digest.generated_at).toLocaleString("fr-FR")} ·{" "}
                {digest.model ?? "IA"}
              </span>
            </div>
            <DigestMarkdown content={digest.content} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mini renderer markdown (titres, listes, gras) — suffit pour les digests.
 * Évite d'ajouter une dépendance lourde juste pour ça.
 */
function DigestMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length > 0) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 text-sm">
          {listBuf.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(l) }} />
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (line.startsWith("# ")) {
      out.push(
        <h3 key={out.length} className="text-lg font-bold tracking-tight">
          {line.slice(2)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      out.push(
        <h4
          key={out.length}
          className="text-sm font-semibold uppercase tracking-wider text-primary mt-3"
        >
          {line.slice(3)}
        </h4>,
      );
    } else if (line.trim() === "") {
      // skip
    } else {
      out.push(
        <p
          key={out.length}
          className="text-sm leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }}
        />,
      );
    }
  }
  flushList();
  return <div className="space-y-2">{out}</div>;
}

function renderInline(text: string): string {
  // Escape HTML d'abord
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(
      /`([^`]+)`/g,
      '<code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">$1</code>',
    );
}

// ----------------- DM massif staff -----------------

type AudienceKind =
  | "all_active"
  | "inactive_7d"
  | "never_logged_in"
  | "poll_not_voted"
  | "role_all"
  | "role_never_logged_in";

const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  all_active: "Tous les membres actifs",
  inactive_7d: "Inactifs 7j (0 msg & 0 vocal)",
  never_logged_in: "Jamais connectés au dashboard",
  poll_not_voted: "N'ont pas voté à un sondage",
  role_all: "Par rôle Discord (tous)",
  role_never_logged_in: "Par rôle Discord — jamais connectés",
};

const DEFAULT_TEMPLATES: Record<AudienceKind, string> = {
  all_active: "Salut {ig_name} 👋\n\n[message à la faction]\n\n— Le staff PunkAstik",
  inactive_7d:
    "Salut {ig_name} 👋\n\nOn ne t'a pas vu cette semaine sur le Discord ni en vocal. Tout va bien ? Donne-nous des nouvelles quand tu peux !",
  never_logged_in:
    "Salut {ig_name} 👋\n\nPetit rappel : connecte-toi au dashboard de la faction au moins une fois pour qu'on puisse te suivre. À très vite !",
  poll_not_voted:
    "Salut {ig_name} 👋\n\nIl reste un sondage en attente de ta réponse — un petit clic suffit. Merci !",
  role_all: "Salut 👋\n\n[message ciblé pour ce rôle]\n\n— Le staff PunkAstik",
  role_never_logged_in:
    "Salut 👋\n\nTu as bien ton rôle sur le Discord faction mais tu ne t'es jamais connecté au dashboard. Petit rappel : connecte-toi une fois pour qu'on puisse te suivre proprement. Merci !",
};

function BulkDmCard() {
  const { data: me } = useCurrentUser();
  const canDm = hasPerm(me, "members.edit");

  const pollsFn = useServerFn(listOpenPollsForDm);
  const rolesFn = useServerFn(listFactionRoles);
  const previewFn = useServerFn(previewDmAudience);
  const sendFn = useServerFn(sendBulkDm);
  const exportFn = useServerFn(exportDmAudience);
  const historyFn = useServerFn(listBulkDmHistory);
  const qc = useQueryClient();

  const [kind, setKind] = useState<AudienceKind>("inactive_7d");
  const [pollId, setPollId] = useState<string>("");
  // Pré-rempli sur le rôle "Membre faction" (1503030823174148216) par défaut.
  const [roleId, setRoleId] = useState<string>("1503030823174148216");
  const [content, setContent] = useState<string>(DEFAULT_TEMPLATES.inactive_7d);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: pollsData } = useQuery({
    queryKey: ["bulk-dm-open-polls"],
    queryFn: () => pollsFn(),
    enabled: canDm,
    staleTime: 60_000,
  });

  const { data: rolesData } = useQuery({
    queryKey: ["bulk-dm-faction-roles"],
    queryFn: () => rolesFn(),
    enabled: canDm,
    staleTime: 5 * 60_000,
  });

  const audience: DmAudience | null = (() => {
    if (kind === "poll_not_voted") return pollId ? { kind: "poll_not_voted", pollId } : null;
    if (kind === "role_all") return roleId ? { kind: "role_all", roleId } : null;
    if (kind === "role_never_logged_in")
      return roleId ? { kind: "role_never_logged_in", roleId } : null;
    return { kind };
  })();

  const preview = useQuery({
    queryKey: ["bulk-dm-preview", JSON.stringify(audience)],
    queryFn: () => previewFn({ data: { audience: audience! } }),
    enabled: canDm && !!audience,
    staleTime: 30_000,
  });

  const sendMut = useMutation({
    mutationFn: () => sendFn({ data: { audience: audience!, content } }),
    onSuccess: (res) => {
      toast.success(
        `DM envoyé à ${res.sent}/${res.total} membre(s)${res.failed > 0 ? ` — ${res.failed} échec(s)` : ""}`,
      );
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["bulk-dm-history"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const history = useQuery({
    queryKey: ["bulk-dm-history"],
    queryFn: () => historyFn(),
    enabled: canDm,
    staleTime: 30_000,
  });

  const exportMut = useMutation({
    mutationFn: () => exportFn({ data: { audience: audience! } }),
    onSuccess: (res) => {
      const header = "discord_id,ig_name,discord_username,current_grade\n";
      const escape = (v: string | null) => {
        const s = (v ?? "").replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };
      const body = res.rows
        .map((r) =>
          [r.discord_id, r.ig_name, r.discord_username, r.current_grade].map(escape).join(","),
        )
        .join("\n");
      const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audience-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${res.rows.length} lignes exportées`);
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (!canDm) return null;

  const targetCount = preview.data?.count ?? 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" />
          Communication staff — DM Discord
          <span className="text-[11px] text-muted-foreground font-normal ml-2">
            Envoi en DM via le bot · ~4/sec · max 500
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Audience
            </label>
            <Select
              value={kind}
              onValueChange={(v: AudienceKind) => {
                setKind(v);
                setContent(DEFAULT_TEMPLATES[v]);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUDIENCE_LABELS) as AudienceKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {AUDIENCE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "poll_not_voted" && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Sondage
              </label>
              <Select value={pollId} onValueChange={setPollId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un sondage ouvert…" />
                </SelectTrigger>
                <SelectContent>
                  {(pollsData?.polls ?? []).length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">Aucun sondage ouvert</div>
                  ) : (
                    (pollsData?.polls ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {(kind === "role_all" || kind === "role_never_logged_in") && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Rôle Discord (serveur faction)
              </label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un rôle…" />
                </SelectTrigger>
                <SelectContent>
                  {(rolesData?.roles ?? []).length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">Chargement des rôles…</div>
                  ) : (
                    (rolesData?.roles ?? []).map((r: { id: string; name: string }) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Message
            </label>
            <span className="text-[11px] text-muted-foreground">
              Variables : <code className="font-mono">{"{ig_name}"}</code>,{" "}
              <code className="font-mono">{"{discord_username}"}</code>,{" "}
              <code className="font-mono">{"{grade}"}</code>
            </span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={1800}
          />
          <div className="text-[11px] text-muted-foreground text-right mt-1">
            {content.length}/1800
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border bg-card/40 p-3">
          <div className="text-sm">
            {audience ? (
              preview.isLoading ? (
                <span className="text-muted-foreground">Calcul de l'audience…</span>
              ) : (
                <>
                  <span className="font-semibold tabular-nums">{targetCount}</span>{" "}
                  <span className="text-muted-foreground">
                    destinataire{targetCount > 1 ? "s" : ""}
                  </span>
                </>
              )
            ) : (
              <span className="text-muted-foreground">
                {kind === "poll_not_voted" ? "Sélectionne un sondage" : "Sélectionne un rôle"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!audience || targetCount === 0 || exportMut.isPending}
              onClick={() => exportMut.mutate()}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              {exportMut.isPending ? "Export…" : "CSV"}
            </Button>
            <Button
              disabled={!audience || targetCount === 0 || content.trim().length === 0}
              onClick={() => setConfirmOpen(true)}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Envoyer
            </Button>
          </div>
        </div>

        {(preview.data?.sample ?? []).length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Aperçu (max 20)
            </div>
            <div className="flex flex-wrap gap-2">
              {preview.data!.sample.map((m) => (
                <Badge key={m.discord_id} variant="outline" className="font-normal">
                  {m.ig_name ?? m.discord_username ?? m.discord_id}
                </Badge>
              ))}
              {targetCount > (preview.data?.sample.length ?? 0) && (
                <Badge variant="secondary">
                  + {targetCount - (preview.data?.sample.length ?? 0)} autres
                </Badge>
              )}
            </div>
          </div>
        )}

        <BulkDmHistoryList items={(history.data?.items ?? []) as unknown as HistoryItem[]} />
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi massif</DialogTitle>
            <DialogDescription>
              Le bot va envoyer un DM Discord à <span className="font-semibold">{targetCount}</span>{" "}
              membre(s) ({AUDIENCE_LABELS[kind]}). L'envoi prendra environ{" "}
              {Math.ceil((targetCount * 0.25) / 60)} min. Confirmer ?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
            {content}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              {sendMut.isPending ? "Envoi en cours…" : `Envoyer à ${targetCount}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type HistoryItem = {
  id: string;
  created_at: string;
  actor_discord_id: string | null;
  payload: {
    audience?: { kind?: AudienceKind };
    sent?: number;
    total?: number;
    failed?: number;
  } | null;
};

type StatusFilter = "all" | "success" | "with_failures" | "empty";

const PER_PAGE = 8;

type SortKey = "date" | "audience" | "status";
type SortDir = "asc" | "desc";
type StaffSearch = { bdmSort: SortKey; bdmDir: SortDir };

function statusRank(p: HistoryItem["payload"]): number {
  const sent = p?.sent ?? 0;
  const total = p?.total ?? 0;
  const failed = p?.failed ?? 0;
  if (total === 0) return 0; // vide
  if (failed > 0) return 1; // avec échecs
  if (sent === 0) return 2; // rien envoyé
  return 3; // succès
}

function BulkDmHistoryList({ items }: { items: HistoryItem[] }) {
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<AudienceKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { bdmSort: sortKey, bdmDir: sortDir } = useSearch({
    from: "/_authenticated/staff" as any,
  }) as StaffSearch;
  const navigate = useNavigate({ from: "/_authenticated/staff" as any });
  const setSortKey = (v: SortKey) =>
    (navigate as any)({
      search: (prev: StaffSearch) => ({ ...prev, bdmSort: v }),
      replace: true,
    });
  const setSortDir = (updater: (d: SortDir) => SortDir) =>
    (navigate as any)({
      search: (prev: StaffSearch) => ({ ...prev, bdmDir: updater(prev.bdmDir ?? "desc") }),
      replace: true,
    });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const out = items.filter((l) => {
      const p = l.payload ?? {};
      const aud = p.audience?.kind;
      if (audienceFilter !== "all" && aud !== audienceFilter) return false;
      const sent = p.sent ?? 0;
      const total = p.total ?? 0;
      const failed = p.failed ?? 0;
      if (statusFilter === "success" && (failed > 0 || sent === 0)) return false;
      if (statusFilter === "with_failures" && failed === 0) return false;
      if (statusFilter === "empty" && total > 0) return false;
      if (needle) {
        const label = aud ? AUDIENCE_LABELS[aud].toLowerCase() : "";
        const actor = (l.actor_discord_id ?? "").toLowerCase();
        if (!label.includes(needle) && !actor.includes(needle)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sortKey === "date") {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      if (sortKey === "audience") {
        const la = a.payload?.audience?.kind ? AUDIENCE_LABELS[a.payload.audience.kind] : "";
        const lb = b.payload?.audience?.kind ? AUDIENCE_LABELS[b.payload.audience.kind] : "";
        return la.localeCompare(lb, "fr") * dir;
      }
      return (statusRank(a.payload) - statusRank(b.payload)) * dir;
    });
    return out;
  }, [items, search, audienceFilter, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageItems = getPagedSlice(filtered, safePage, PER_PAGE);

  const resetPage = () => setPage(1);

  if (items.length === 0) return null;

  return (
    <div className="pt-2 border-t border-border">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <History className="size-3" /> Dernières campagnes
        <span className="ml-auto normal-case tracking-normal text-muted-foreground/80">
          {filtered.length} / {items.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder="Rechercher (audience, auteur)…"
          className="h-8 text-xs"
        />
        <Select
          value={audienceFilter}
          onValueChange={(v) => {
            setAudienceFilter(v as AudienceKind | "all");
            resetPage();
          }}
        >
          <SelectTrigger className="h-8 text-xs w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes audiences</SelectItem>
            {(Object.keys(AUDIENCE_LABELS) as AudienceKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {AUDIENCE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as StatusFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="h-8 text-xs w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="success">Sans échec</SelectItem>
            <SelectItem value="with_failures">Avec échecs</SelectItem>
            <SelectItem value="empty">Audience vide</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-muted-foreground">Trier par</span>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="audience">Audience</SelectItem>
            <SelectItem value="status">Statut</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          title={sortDir === "asc" ? "Croissant" : "Décroissant"}
        >
          {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
        </Button>
      </div>

      {pageItems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Aucune campagne ne correspond aux filtres.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {pageItems.map((l) => {
            const p = l.payload ?? {};
            const aud = p.audience?.kind;
            return (
              <li key={l.id} className="py-2 flex items-center gap-3 text-xs">
                <span className="font-mono tabular-nums w-20 text-muted-foreground">
                  {new Date(l.created_at).toLocaleDateString("fr-FR")}{" "}
                  {new Date(l.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <Badge variant="outline" className="font-normal">
                  {aud ? AUDIENCE_LABELS[aud] : "?"}
                </Badge>
                <span className="ml-auto tabular-nums">
                  <span className="text-primary font-semibold">{p.sent ?? 0}</span>
                  <span className="text-muted-foreground">/{p.total ?? 0}</span>
                  {(p.failed ?? 0) > 0 && (
                    <span className="text-destructive ml-2">· {p.failed} échec(s)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="mt-3">
          <Paginator page={safePage} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

// ----------------- Inactivité multi-seuils (7/14/30j) -----------------

function InactivityCard() {
  const fn = useServerFn(getInactivityBuckets);
  const { data, isLoading } = useQuery({
    queryKey: ["inactivity-buckets"],
    queryFn: () => fn(),
  });
  const [tab, setTab] = useState<"d7" | "d14" | "d30">("d7");

  const buckets = data ?? { d7: [], d14: [], d30: [] };
  const current = buckets[tab];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-primary" />
            Membres inactifs
          </span>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "d7" | "d14" | "d30")}>
            <TabsList>
              <TabsTrigger value="d7">7j ({buckets.d7.length})</TabsTrigger>
              <TabsTrigger value="d14">14j ({buckets.d14.length})</TabsTrigger>
              <TabsTrigger value="d30">30j ({buckets.d30.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <RowListSkeleton count={4} />
        ) : current.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {tab === "d7"
              ? "Tout le monde s'est manifesté cette semaine ✨"
              : tab === "d14"
                ? "Aucun membre inactif depuis 14 jours."
                : "Aucun membre inactif depuis 30 jours."}
          </p>
        ) : (
          current.map((m: any) => <InactiveMemberRow key={m.discord_id} member={m} />)
        )}
      </CardContent>
    </Card>
  );
}

// ----------------- Jamais connectés au site -----------------

function NeverConnectedCard() {
  const fn = useServerFn(getNeverConnectedMembers);
  const { data, isLoading } = useQuery({
    queryKey: ["never-connected"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <UserPlus className="size-4 text-amber-500" />
            Jamais connectés au site
          </span>
          <Badge variant="outline">{data?.total ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <RowListSkeleton count={4} />
        ) : (data?.members ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Tous les membres de la faction se sont déjà connectés au site ✨
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              Membres de la faction privée qui n'ont jamais ouvert le site. Envoie-leur un DM pour
              les inviter à se connecter.
            </p>
            {(data?.members ?? []).map((m: any) => (
              <NeverConnectedRow key={m.discord_id} member={m} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NeverConnectedRow({
  member,
}: {
  member: {
    discord_id: string;
    ig_name?: string | null;
    discord_username?: string | null;
    avatar_url?: string | null;
    current_grade?: string | null;
    last_dm_at?: string | null;
    has_voted?: boolean;
  };
}) {
  const dmFn = useServerFn(dmMember);
  const queryClient = useQueryClient();
  const [dmOpen, setDmOpen] = useState(false);
  const [dmContent, setDmContent] = useState(
    `Yo ${member.ig_name ?? member.discord_username ?? ""} 👋\n\nT'as toujours pas activé ton compte sur le site de la faction ! Va faire un tour ici : https://punkastik.com\n\nTu pourras y voir tes points, poser des absences, suivre les classements, etc. 🚀`,
  );

  const dmMut = useMutation({
    mutationFn: () => dmFn({ data: { memberDiscordId: member.discord_id, content: dmContent } }),
    onSuccess: () => {
      toast.success("DM envoyé");
      setDmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["never-connected"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="flex items-center gap-2 border border-border rounded p-2 hover:border-primary/40 transition">
      <Link
        to="/members/$id"
        params={{ id: member.discord_id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="size-8 rounded-full" />
        ) : (
          <div className="size-8 rounded-full bg-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {member.ig_name ?? member.discord_username ?? member.discord_id}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            @{member.discord_username ?? "—"} · {member.current_grade ?? "—"}
          </div>
          {member.has_voted && (
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
              A participé à un sondage (vote importé)
            </div>
          )}
          {member.last_dm_at ? (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
              Relancé le{" "}
              {new Date(member.last_dm_at).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/70 truncate">Jamais relancé</div>
          )}
        </div>
      </Link>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDmOpen(true)}
        title="Relancer par DM Discord"
      >
        <MessageCircle className="size-3.5" />
      </Button>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relancer {member.ig_name ?? member.discord_username}</DialogTitle>
            <DialogDescription>
              Le message sera envoyé en DM Discord depuis le bot de la faction.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={dmContent}
            onChange={(e) => setDmContent(e.target.value)}
            rows={6}
            maxLength={1800}
          />
          <div className="text-[11px] text-muted-foreground text-right">
            {dmContent.length}/1800
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDmOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => dmMut.mutate()}
              disabled={dmMut.isPending || dmContent.trim().length === 0}
            >
              {dmMut.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------- File de relance (inactivité) -----------------

type InactivityRow = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  inactivityDays: number;
  onDeclaredAbsence: boolean;
  absenceUntil: string | null;
  lastPingAt: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InactivityQueueCard() {
  const fn = useServerFn(getInactivityQueue);
  const { data, isLoading } = useQuery({
    queryKey: ["inactivity-queue"],
    queryFn: () => fn(),
  });

  const rows: InactivityRow[] = (data?.rows ?? []) as InactivityRow[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            File de relance
          </span>
          <Badge variant="outline">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[32rem] overflow-y-auto">
        {isLoading ? (
          <RowListSkeleton count={5} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Personne à relancer, tout le monde est actif ✨
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              Triés par jours d&apos;inactivité décroissants. Les membres en absence déclarée sont
              signalés — pense à vérifier avant de relancer.
            </p>
            <div className="hidden md:grid grid-cols-[1fr_90px_140px_140px_110px] gap-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <div>Membre</div>
              <div className="text-right">Inactif</div>
              <div>Statut</div>
              <div>Dernière relance</div>
              <div className="text-right">Action</div>
            </div>
            {rows.map((m) => (
              <InactivityRowItem key={m.discord_id} member={m} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InactivityRowItem({ member }: { member: InactivityRow }) {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendInactivityPing);
  const [open, setOpen] = useState(false);
  const greeting = member.ig_name ?? member.discord_username ?? "";
  const [content, setContent] = useState(
    `Hey ${greeting} 👋\n\nOn te voit plus trop en jeu ces derniers temps, tout va bien ? Si t'as besoin de poser une absence, dis-le nous (ou viens passer un bonjour 😄).`,
  );

  const mut = useMutation({
    mutationFn: () => sendFn({ data: { memberDiscordId: member.discord_id, message: content } }),
    onSuccess: () => {
      toast.success("Relance envoyée");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["inactivity-queue"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const dim = member.onDeclaredAbsence;

  return (
    <div
      className={`grid md:grid-cols-[1fr_90px_140px_140px_110px] grid-cols-1 gap-2 items-center border border-border rounded p-2 hover:border-primary/40 transition ${
        dim ? "opacity-60" : ""
      }`}
    >
      <Link
        to="/members/$id"
        params={{ id: member.discord_id }}
        className="flex items-center gap-3 min-w-0"
      >
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="size-8 rounded-full" />
        ) : (
          <div className="size-8 rounded-full bg-muted" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {member.ig_name ?? member.discord_username ?? member.discord_id}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            @{member.discord_username ?? "—"} · {member.current_grade ?? "—"}
          </div>
        </div>
      </Link>

      <div className="md:text-right text-sm tabular-nums font-semibold">
        {member.inactivityDays}j
      </div>

      <div>
        {member.onDeclaredAbsence ? (
          <Badge variant="outline" className="border-amber-500/50 text-amber-500">
            En absence{member.absenceUntil ? ` · ${formatDate(member.absenceUntil)}` : ""}
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground">{formatDate(member.lastPingAt)}</div>

      <div className="md:text-right">
        <Button
          size="sm"
          variant={dim ? "ghost" : "outline"}
          onClick={() => setOpen(true)}
          title={dim ? "Ce membre est en absence déclarée" : "Relancer par DM Discord"}
        >
          <MessageCircle className="size-3.5 mr-1" />
          Relancer
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relancer {greeting || member.discord_id}</DialogTitle>
            <DialogDescription>
              DM Discord envoyé par le bot. La relance sera tracée dans l&apos;historique.
              {member.onDeclaredAbsence ? (
                <span className="block mt-2 text-amber-500">
                  ⚠️ Ce membre est en absence déclarée
                  {member.absenceUntil ? ` jusqu'au ${formatDate(member.absenceUntil)}` : ""}.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={1800}
          />
          <div className="text-[11px] text-muted-foreground text-right">{content.length}/1800</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || content.trim().length === 0}
            >
              {mut.isPending ? "Envoi…" : "Envoyer la relance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnomaliesCard — détection statistique + explication IA, décision humaine.
// ─────────────────────────────────────────────────────────────────────────────

const ANOMALY_KIND_LABEL: Record<OpenAnomalyRow["kind"], string> = {
  point_farm: "Pic de points inhabituel",
  alt_transfer: "Transfert entre alts",
  ratio_mismatch: "Messages / vocal incohérents",
  new_farmer: "Nouveau arrivant — gros gains",
};

const SEVERITY_STYLES: Record<OpenAnomalyRow["severity"], string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  med: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  low: "bg-muted text-muted-foreground border-border",
};

function AnomaliesCard() {
  const fn = useServerFn(getOpenAnomalies);
  const updateFn = useServerFn(updateAnomalyStatus);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["anomaly-flags-open"],
    queryFn: () => fn(),
  });

  const mut = useMutation({
    mutationFn: (vars: { id: string; status: "reviewed" | "dismissed" }) =>
      updateFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "reviewed" ? "Marqué comme examiné" : "Signalement ignoré");
      qc.invalidateQueries({ queryKey: ["anomaly-flags-open"] });
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const rows = data?.rows ?? [];

  return (
    <Guard perm="members.view">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            Anomalies à examiner
            {rows.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {rows.length}
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Signalement automatique — décision humaine requise, aucune sanction n'a été appliquée.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <RowListSkeleton count={3} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="Aucune anomalie ouverte"
              description="Le scanner tourne toutes les heures."
              variant="compact"
            />
          ) : (
            rows.map((flag) => (
              <div
                key={flag.id}
                className="border border-border rounded-md p-3 space-y-2 bg-card/50"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={SEVERITY_STYLES[flag.severity]}>
                    {flag.severity.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-medium">{ANOMALY_KIND_LABEL[flag.kind]}</span>
                  <Link
                    to="/members/$id"
                    params={{ id: flag.member_discord_id }}
                    className="flex items-center gap-2 ml-auto hover:underline"
                  >
                    {flag.avatar_url ? (
                      <img src={flag.avatar_url} alt="" className="size-6 rounded-full" />
                    ) : (
                      <div className="size-6 rounded-full bg-muted" />
                    )}
                    <span className="text-sm">
                      {flag.ig_name ?? flag.discord_username ?? flag.member_discord_id}
                    </span>
                  </Link>
                </div>

                {flag.ai_explanation ? (
                  <p className="text-sm text-foreground/90 italic">{flag.ai_explanation}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Explication IA en attente (sera générée au prochain scan).
                  </p>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Données brutes (evidence)
                  </summary>
                  <pre className="mt-2 p-2 rounded bg-muted/50 overflow-x-auto text-[11px] leading-snug">
                    {JSON.stringify(flag.evidence, null, 2)}
                  </pre>
                </details>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ id: flag.id, status: "reviewed" })}
                  >
                    Examiné
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ id: flag.id, status: "dismissed" })}
                  >
                    Ignorer
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </Guard>
  );
}

// ==========================================================
// ChurnSection : risque de départ + cohortes de rétention
// ==========================================================

function ChurnSection() {
  const fnRisk = useServerFn(getChurnRisk);
  const fnCohorts = useServerFn(getRetentionCohorts);
  const { data: risk, isLoading: riskLoading } = useQuery({
    queryKey: ["churn-risk"],
    queryFn: () => fnRisk(),
  });
  const { data: cohorts, isLoading: cohortsLoading } = useQuery({
    queryKey: ["retention-cohorts"],
    queryFn: () => fnCohorts(),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserMinus className="size-4 text-orange-500" />
            Risque de départ
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Estimation heuristique — pas une certitude. Aucune action automatique.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {riskLoading ? (
            <RowListSkeleton count={5} />
          ) : (risk?.rows?.length ?? 0) === 0 ? (
            <EmptyState
              icon={UserMinus}
              title="Aucun membre à risque détecté"
              description="Les snapshots d'activité alimenteront ce panneau."
              variant="compact"
            />
          ) : (
            <>
              {risk!.rows.slice(0, 12).map((r: ChurnRow) => (
                <Link
                  key={r.discord_id}
                  to="/members/$id"
                  params={{ id: r.discord_id }}
                  className="flex items-center gap-3 border border-border rounded p-2 hover:border-primary/40 transition"
                  title={`activity_drop=${r.factors.activity_drop.toFixed(2)} · trend=${r.factors.presence_trend.toFixed(3)} · tenure=${r.factors.tenure_days}j`}
                >
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="size-8 rounded-full" />
                  ) : (
                    <div className="size-8 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {r.ig_name ?? r.discord_username ?? r.discord_id}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      chute {Math.round(r.factors.activity_drop * 100)}% · pente{" "}
                      {r.factors.presence_trend.toFixed(2)}/j · {r.factors.tenure_days}j
                    </div>
                  </div>
                  <Badge
                    variant={
                      r.score >= 70 ? "destructive" : r.score >= 40 ? "secondary" : "outline"
                    }
                  >
                    {r.score}
                  </Badge>
                </Link>
              ))}
              <p className="text-[10px] text-muted-foreground pt-2">{risk!.formula}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4 text-primary" />
            Rétention par cohorte
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            % encore actifs à M+1 / M+3 / M+6, par mois d'arrivée.
          </p>
        </CardHeader>
        <CardContent>
          {cohortsLoading ? (
            <RowListSkeleton count={5} />
          ) : (cohorts?.cohorts?.length ?? 0) === 0 ? (
            <EmptyState
              icon={HeartPulse}
              title="Pas encore de cohorte"
              description="Les arrivées datées rempliront cette grille."
              variant="compact"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2">Cohorte</th>
                    <th className="py-1 pr-2 text-right">N</th>
                    <th className="py-1 pr-2 text-right">M+1</th>
                    <th className="py-1 pr-2 text-right">M+3</th>
                    <th className="py-1 pr-2 text-right">M+6</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts!.cohorts.map((c: CohortRow) => (
                    <tr key={c.month} className="border-t border-border">
                      <td className="py-1 pr-2 font-mono">{c.month}</td>
                      <td className="py-1 pr-2 text-right">{c.arrived}</td>
                      <RetentionCell rate={c.m1Rate} />
                      <RetentionCell rate={c.m3Rate} />
                      <RetentionCell rate={c.m6Rate} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RetentionCell({ rate }: { rate: number }) {
  if (rate < 0) {
    return <td className="py-1 pr-2 text-right text-muted-foreground">—</td>;
  }
  const pct = Math.round(rate * 100);
  // Heatmap : vert clair -> vert foncé selon le %
  const intensity = Math.max(0.1, Math.min(1, rate));
  const bg = `color-mix(in oklab, hsl(var(--primary)) ${Math.round(intensity * 60)}%, transparent)`;
  return (
    <td className="py-1 pr-2 text-right">
      <span
        className="inline-block px-1.5 py-0.5 rounded text-foreground"
        style={{ background: bg }}
      >
        {pct}%
      </span>
    </td>
  );
}

function MissingMcCard() {
  const fn = useServerFn(getMembersWithoutMc);
  const { data, isLoading } = useQuery({
    queryKey: ["missing-mc"],
    queryFn: () => fn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Sans pseudo Minecraft
          </span>
          <Badge variant="outline">{data?.total ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <RowListSkeleton count={4} />
        ) : (data?.members ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Tous les membres ont lié leur compte Minecraft ✨
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              Membres actifs sans compte MC lié. Tu peux le renseigner toi-même (validation Mojang).
            </p>
            {(data?.members ?? []).map((m: any) => (
              <MissingMcRow key={m.discord_id} member={m} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MissingMcRow({
  member,
}: {
  member: {
    discord_id: string;
    ig_name?: string | null;
    discord_username?: string | null;
    avatar_url?: string | null;
    current_grade?: string | null;
  };
}) {
  const qc = useQueryClient();
  const setMcFn = useServerFn(setMemberMcByStaff);
  const dmFn = useServerFn(dmMember);
  const [open, setOpen] = useState(false);
  const [igName, setIgName] = useState(member.ig_name ?? "");

  const setMcMut = useMutation({
    mutationFn: () =>
      setMcFn({ data: { memberDiscordId: member.discord_id, igName: igName.trim() } }),
    onSuccess: (r) => {
      toast.success(`Compte lié : ${r.igName}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["missing-mc"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const dmMut = useMutation({
    mutationFn: () =>
      dmFn({
        data: {
          memberDiscordId: member.discord_id,
          content: `Yo ${member.ig_name ?? member.discord_username ?? ""} 👋\n\nPense à renseigner ton pseudo Minecraft sur https://punkastik.com/me pour apparaître dans l'économie faction !`,
        },
      }),
    onSuccess: () => toast.success("DM envoyé"),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="flex items-center gap-2 border border-border rounded p-2 hover:border-primary/40 transition">
      <Link
        to="/members/$id"
        params={{ id: member.discord_id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="size-8 rounded-full" />
        ) : (
          <div className="size-8 rounded-full bg-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {member.ig_name ?? member.discord_username ?? member.discord_id}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            @{member.discord_username ?? "—"} · {member.current_grade ?? "—"}
          </div>
        </div>
      </Link>
      <Button
        size="sm"
        variant="outline"
        onClick={() => dmMut.mutate()}
        disabled={dmMut.isPending}
        title="Lui rappeler par DM"
      >
        <MessageCircle className="size-3.5" />
      </Button>
      <Button size="sm" onClick={() => setOpen(true)} title="Lier son pseudo MC">
        Lier
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Lier le compte MC de {member.ig_name ?? member.discord_username}
            </DialogTitle>
            <DialogDescription>
              Le pseudo est vérifié via l'API Mojang et le membre sera ajouté au suivi HDV.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={igName}
            onChange={(e) => setIgName(e.target.value)}
            placeholder="Pseudo Minecraft"
            maxLength={16}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => setMcMut.mutate()}
              disabled={setMcMut.isPending || igName.trim().length < 3}
            >
              {setMcMut.isPending ? "Vérification…" : "Lier le compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
