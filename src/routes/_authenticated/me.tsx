import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Coins, Gamepad2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { getMyOverview, completeOnboarding } from "@/lib/data/me.functions";
import { getPointsTimeline } from "@/lib/data/points-timeline.functions";
import { SinglePointsChart } from "@/components/points/PointsChart";
import { getLatestPlayerCount } from "@/lib/paladium/history.functions";
import { avatarUrl } from "@/lib/paladium/api";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ObjectivesCard } from "@/components/me/ObjectivesCard";
import { AbsencesCard } from "@/components/me/AbsencesCard";
import { WarningsCard } from "@/components/me/WarningsCard";
import { PaladiumProfileCard } from "@/components/me/PaladiumProfileCard";
import { EmptyState } from "@/components/EmptyState";
import { DetailPageSkeleton } from "@/components/Skeletons";
import { MonoLabel } from "@/components/tools/ToolsUi";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "Mon profil · PunkAstik" }] }),
  component: MyProfile,
});

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  const d = new Date(iso);
  return `le ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function MyProfile() {
  const overviewFn = useServerFn(getMyOverview);
  const playerCountFn = useServerFn(getLatestPlayerCount);

  const { data, isLoading } = useQuery({
    queryKey: ["me", "overview"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const { data: playerCountData } = useQuery({
    queryKey: ["paladium", "player-count"],
    queryFn: () => playerCountFn(),
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  if (isLoading || !data) return <DetailPageSkeleton />;
  const m = data.member;
  const isMember = Boolean(m.ig_name || m.current_grade || m.arrival_date || m.mc_uuid);

  const lastPointsUpdate = data.recentGains[0]?.created_at ?? null;

  return (
    <div className="space-y-6 w-full mx-auto 2xl:max-w-[2000px]">
      {/* Bandeau joueurs connectés */}
      {playerCountData?.online != null && (
        <div className="flex items-center gap-2 border-[3px] border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="w-2 h-2 bg-primary motion-safe:animate-pulse shrink-0" aria-hidden />
          <span className="text-muted-foreground">Joueurs en ligne sur Paladium :</span>
          <span className="font-bold text-primary tabular-nums">{playerCountData.online}</span>
          {playerCountData.capturedAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              {formatRelative(playerCountData.capturedAt)}
            </span>
          )}
        </div>
      )}

      {/* En-tête profil */}
      <div className="flex flex-wrap items-center gap-4">
        {m.avatar_url ? (
          <img src={m.avatar_url} className="size-16 rounded-full" alt="" />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <div className="min-w-0">
          <div className="text-primary mb-1">
            <MonoLabel>// mon profil</MonoLabel>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk'" }}>
            {m.ig_name ?? m.discord_username}
          </h1>
          <p className="text-sm text-muted-foreground">@{m.discord_username}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={m.status} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3 items-start">
        {/* Colonne principale */}
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{m.astik_points}</div>
              {lastPointsUpdate && (
                <div className="text-xs text-muted-foreground mt-1">
                  Dernière actualisation : {formatRelative(lastPointsUpdate)}
                </div>
              )}
            </CardContent>
          </Card>

          <PointsEvolutionCard memberDiscordId={m.discord_id} />

          {isMember && m.mc_uuid && <PaladiumProfileCard />}

          {isMember && <ObjectivesCard />}
        </div>

        {/* Colonne secondaire */}
        <div className="space-y-6">
          <MinecraftAccountCard mcUuid={m.mc_uuid} igName={m.ig_name} />

          {isMember && <AbsencesCard />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Coins className="size-4 text-primary" /> Mes derniers gains
                </span>
                <Badge variant="outline">{data.recentGains.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentGains.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Coins}
                    title="Aucun mouvement"
                    description="Tes gains apparaîtront ici."
                    variant="compact"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border max-h-96 overflow-y-auto">
                  {data.recentGains.map((p) => (
                    <li key={p.id} className="px-4 py-2 text-sm flex items-center gap-3">
                      <span
                        className={`font-mono font-semibold w-16 text-right ${
                          p.amount >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {p.amount >= 0 ? "+" : ""}
                        {p.amount}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs">
                          {p.action_type}
                          {p.reason ? ` · ${p.reason}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("fr-FR")}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        → {p.total_after}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <WarningsCard />
        </div>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  active: { label: "Actif", dot: "bg-emerald-500" },
  trial: { label: "Période d'essai", dot: "bg-amber-500" },
  away: { label: "En pause", dot: "bg-primary/60" },
  former: { label: "Ancien", dot: "bg-muted-foreground/60" },
  left: { label: "Parti", dot: "bg-muted-foreground/60" },
  visitor: { label: "Visiteur", dot: "bg-muted-foreground/60" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, dot: "bg-muted-foreground/60" };
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </Badge>
  );
}

function MinecraftAccountCard({
  mcUuid,
  igName,
}: {
  mcUuid: string | null;
  igName: string | null;
}) {
  const queryClient = useQueryClient();
  const submit = useServerFn(completeOnboarding);
  const [editing, setEditing] = useState(!mcUuid);
  const [name, setName] = useState(igName ?? "");
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (value: string) => submit({ data: { igName: value.trim(), alts: [] } }),
    onSuccess: () => {
      toast.success("Compte Minecraft lié");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["me", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["me-overview"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const onSubmit = () => {
    if (name.trim().length < 3) {
      toast.error("Pseudo Minecraft requis");
      return;
    }
    mutation.mutate(name);
  };

  const copyUuid = () => {
    if (!mcUuid) return;
    navigator.clipboard.writeText(mcUuid);
    setCopied(true);
    toast.success("UUID copié");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gamepad2 className="size-4 text-primary" /> Mon compte Minecraft
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mcUuid && !editing ? (
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl(mcUuid, 64)}
              alt={igName ?? ""}
              className="size-16 rounded-md bg-muted"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{igName ?? "—"}</div>
              <button
                type="button"
                onClick={copyUuid}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title={mcUuid}
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "UUID copié" : "Copier l'UUID"}
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="mc-ig">Pseudo Minecraft</Label>
              <Input
                id="mc-ig"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Notch"
                maxLength={16}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Vérifié via l'API Mojang — relie ton pseudo en jeu à ton profil.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={onSubmit} disabled={mutation.isPending}>
                {mutation.isPending
                  ? "Vérification…"
                  : mcUuid
                    ? "Mettre à jour"
                    : "Lier mon compte"}
              </Button>
              {mcUuid && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setName(igName ?? "");
                  }}
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PointsEvolutionCard ─────────────────────────────────────────────────────

function PointsEvolutionCard({ memberDiscordId }: { memberDiscordId: string }) {
  const timelineFn = useServerFn(getPointsTimeline);
  const { data, isLoading } = useQuery({
    queryKey: ["points-timeline", memberDiscordId],
    queryFn: () => timelineFn({ data: { memberDiscordId } }),
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Évolution des points</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-40 animate-pulse bg-muted" />
        ) : (
          <SinglePointsChart timeline={data?.timeline ?? []} label="AstikPoints" />
        )}
      </CardContent>
    </Card>
  );
}
