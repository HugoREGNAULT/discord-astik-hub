import { createFileRoute, Link } from "@tanstack/react-router";
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
import { markMemberAway, dmMember } from "@/lib/data/members.functions";
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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="size-6 text-primary" /> Dashboard staff
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de la faction : alertes, files d'attente et activité récente.
        </p>
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

      {/* Applications timeline + global stats */}
      <ApplicationsTimelineCard
        timeline={data.applicationsTimeline ?? []}
        stats={
          data.applicationsStats ?? { total: 0, accepted: 0, rejected: 0, acceptanceRate: 0 }
        }
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

