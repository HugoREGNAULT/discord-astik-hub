import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
import { Paginator, usePagedSlice } from "@/components/Paginator";
import { getMyOverview } from "@/lib/data/me.functions";
import { deleteMyAccount } from "@/lib/data/account.functions";


export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Mon espace · PunkAstik" },
      {
        name: "description",
        content: "Ton profil PunkAstik : skin Minecraft, AstikPoints, grade et activité dans la faction.",
      },
    ],
  }),
  component: MePage,
});

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
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
    return <div className="text-muted-foreground">Chargement…</div>;
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
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Profil de</p>
            <h1 className="text-4xl font-bold tracking-tight">{m.ig_name}</h1>
            <p className="text-muted-foreground">@{m.discord_username ?? "—"}</p>
            <div className="flex gap-2 mt-3 justify-center md:justify-start flex-wrap">
              {m.current_grade && (
                <Badge variant="secondary" className="gap-1">
                  <Award className="size-3" /> {m.current_grade}
                </Badge>
              )}
              {m.status === "active" ? (
                <Badge className="bg-green-500/15 text-green-500 hover:bg-green-500/20">Actif</Badge>
              ) : (
                <Badge variant="outline">Ancien</Badge>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground justify-center md:justify-start">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                <span>
                  Arrivé le <span className="text-foreground font-medium">{formatDate(m.arrival_date)}</span>
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
                <p className="text-sm text-muted-foreground">Aucun alt enregistré.</p>
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

          {data.warnings.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="size-4" /> Avertissements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {data.warnings.map((w) => (
                    <li key={w.id} className="border-l-2 border-destructive pl-3">
                      <div>{w.body}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <DangerZone />
    </div>
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
    onError: (e: Error) => toast.error(e.message),
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
          Cette action efface tes alts, notes, warnings, candidatures et historique
          de points. Ta fiche membre est anonymisée et passée en « ancien ».
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
                Tape <code className="font-mono font-bold">SUPPRIMER</code> ci-dessous
                pour confirmer définitivement.
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
                onClick={(e) => { e.preventDefault(); mDel.mutate(); }}
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

function PointsTimeline({ gains }: { gains: Gain[] }) {
  const [page, setPage] = useState(1);
  const perPage = 10;
  const slice = usePagedSlice(gains, page, perPage);
  const pageCount = Math.ceil(gains.length / perPage);

  if (gains.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun mouvement récent.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {slice.map((g) => (
          <li key={g.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{g.reason ?? g.action_type}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(g.created_at).toLocaleString("fr-FR")}
                {g.staff_username && ` · par ${g.staff_username}`}
              </div>
            </div>
            <div
              className={`text-sm font-mono font-semibold ${
                g.amount >= 0 ? "text-green-500" : "text-destructive"
              }`}
            >
              {g.amount >= 0 ? "+" : ""}
              {g.amount.toLocaleString("fr-FR")}
            </div>
          </li>
        ))}
      </ul>
      <Paginator page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

