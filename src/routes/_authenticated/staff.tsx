import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
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
} from "lucide-react";

import { Guard } from "@/components/Guard";
import { getStaffDashboard } from "@/lib/data/staff.functions";
import { getFactionHealth } from "@/lib/data/health.functions";
import { getLatestDigest, generateDigestManually } from "@/lib/data/digest.functions";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import {
  AreaChart,
  Area,
  XAxis as RXAxis,
  YAxis as RYAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid as RGrid,
} from "recharts";
import { Sparkles, HeartPulse, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
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
import { Send, Megaphone, Download, History } from "lucide-react";
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
import { ApplicationsChart } from "@/components/ApplicationsChart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp as TrendingUpIcon,
  UserPlus as UserPlusIcon,
  ShieldAlert as ShieldAlertIcon,
  Activity as ActivityIcon,
  ShoppingCart as ShoppingCartIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Dashboard staff · PunkAstik" }] }),
  component: () => (
    <Guard perm="members.view">
      <StaffPage />
    </Guard>
  ),
});

function StaffPage() {
  const fn = useServerFn(getStaffDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

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
      <PageHeader
        code="// staff"
        title="Dashboard staff"
        description="Vue d'ensemble de la faction : alertes, files d'attente et activité récente."
      />

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

      {/* Applications timeline + global stats */}
      <ApplicationsTimelineCard
        timeline={data.applicationsTimeline ?? []}
        stats={data.applicationsStats ?? { total: 0, accepted: 0, rejected: 0, acceptanceRate: 0 }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inactifs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-pink-500" />
                Membres inactifs (7 jours)
              </span>
              <Badge variant="outline">{data.inactiveMembers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {data.inactiveMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tout le monde s'est manifesté cette semaine ✨
              </p>
            ) : (
              data.inactiveMembers.map((m: any) => (
                <InactiveMemberRow key={m.discord_id} member={m} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Top contributeurs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Top contributeurs (7j)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topContributors.length === 0 ? (
              <EmptyState
                icon={TrendingUpIcon}
                title="Aucun gain de points cette semaine"
                description="Les contributeurs apparaîtront ici dès les premiers gains."
                variant="compact"
              />
            ) : (
              data.topContributors.map((m, i) => (
                <Link
                  key={m.discord_id}
                  to="/members/$id"
                  params={{ id: m.discord_id }}
                  className="flex items-center gap-3 border border-border rounded p-2 hover:border-primary/40 transition"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="size-8 rounded-full" />
                  ) : (
                    <div className="size-8 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.ig_name ?? m.discord_username}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Coins className="size-3" /> +{m.points}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Candidatures en attente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="size-4 text-pink-500" />
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
              <Link to="/donations">Gérer</Link>
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
      ? "border-pink-500/50 bg-pink-500/5"
      : accent === "blurple"
        ? "border-[#5865F2]/50 bg-[#5865F2]/5"
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
    `Salut ${member.ig_name ?? member.discord_username ?? ""} 👋\n\nOn ne t'a pas vu cette semaine sur le Discord ni en vocal. Tout va bien ? Donne-nous des nouvelles quand tu peux !`,
  );

  const awayMut = useMutation({
    mutationFn: () => awayFn({ data: { memberDiscordId: member.discord_id } }),
    onSuccess: () => {
      toast.success("Membre marqué en absence");
      qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dmMut = useMutation({
    mutationFn: () => dmFn({ data: { memberDiscordId: member.discord_id, content: dmContent } }),
    onSuccess: () => {
      toast.success("DM envoyé");
      setDmOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
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
        <Button
          size="sm"
          variant="outline"
          disabled={awayMut.isPending}
          onClick={() => {
            if (confirm(`Marquer ${member.ig_name ?? member.discord_username} en absence ?`)) {
              awayMut.mutate();
            }
          }}
          title="Marquer en absence"
        >
          <UserMinus className="size-3.5" />
        </Button>
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
    refetchInterval: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4 text-pink-500" /> Santé faction
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
          <HeartPulse className="size-4 text-pink-500" />
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
            Évolution effectif (90 jours)
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.evolution} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RGrid strokeDasharray="3 3" stroke="#27272a" />
                <RXAxis
                  dataKey="date"
                  stroke="#52525b"
                  tick={{ fill: "#e4e4e7", fontSize: 11 }}
                  tickFormatter={(d: string) =>
                    new Date(d).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })
                  }
                  minTickGap={30}
                />
                <RYAxis
                  stroke="#52525b"
                  tick={{ fill: "#e4e4e7", fontSize: 11 }}
                  width={32}
                  allowDecimals={false}
                />
                <RTooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#e4e4e7",
                  }}
                  labelStyle={{ color: "#fafafa" }}
                  labelFormatter={(l: string) => new Date(l).toLocaleDateString("fr-FR")}
                  formatter={(v: number) => [`${v} membres`, "Effectif"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#ec4899"
                  strokeWidth={2}
                  fill="url(#healthGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
    refetchInterval: 10 * 60_000,
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
    onError: (e: Error) => toast.error(e.message),
  });

  const digest = data?.digest;

  return (
    <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-pink-500" />
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
          className="text-sm font-semibold uppercase tracking-wider text-pink-400 mt-3"
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
  role_all:
    "Salut 👋\n\n[message ciblé pour ce rôle]\n\n— Le staff PunkAstik",
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
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canDm) return null;

  const targetCount = preview.data?.count ?? 0;

  return (
    <Card className="border-[#5865F2]/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-[#5865F2]" />
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

        {(history.data?.items ?? []).length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <History className="size-3" /> Dernières campagnes
            </div>
            <ul className="divide-y divide-border max-h-56 overflow-y-auto">
              {history.data!.items.map((l: any) => {
                const p = l.payload ?? {};
                const aud = p.audience?.kind as AudienceKind | undefined;
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
                      {p.failed > 0 && (
                        <span className="text-destructive ml-2">· {p.failed} échec(s)</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
