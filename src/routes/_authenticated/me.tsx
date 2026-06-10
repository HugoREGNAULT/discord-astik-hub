import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Coins, Gamepad2, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { getMyOverview, completeOnboarding } from "@/lib/data/me.functions";
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
import { ActivityHeatmapCard } from "@/components/me/ActivityHeatmapCard";
import { MonthlyRecapCard } from "@/components/me/MonthlyRecapCard";
import { QuestsCard } from "@/components/me/QuestsCard";
import { FactionBentoCard } from "@/components/me/FactionBentoCard";
import { EmptyState } from "@/components/EmptyState";
import { DetailPageSkeleton } from "@/components/Skeletons";
import { MonoLabel } from "@/components/tools/ToolsUi";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "Mon profil · PunkAstik" }] }),
  component: MyProfile,
});

function MyProfile() {
  const overviewFn = useServerFn(getMyOverview);

  const { data, isLoading } = useQuery({
    queryKey: ["me", "overview"],
    queryFn: () => overviewFn(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  if (isLoading || !data) return <DetailPageSkeleton />;
  const m = data.member;
  // Vrai membre faction (≠ simple visiteur connecté) : conditionne les cartes faction.
  const isMember = Boolean(m.ig_name || m.current_grade || m.arrival_date || m.mc_uuid);

  return (
    <div className="space-y-6 w-full mx-auto 2xl:max-w-[2000px]">
      <div className="flex flex-wrap items-center gap-4">
        {m.avatar_url ? (
          <img src={m.avatar_url} className="size-16 rounded-full" alt="" />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <div className="min-w-0">
          <div className="text-pink-500 mb-1">
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
        {/* Colonne principale : identité, progression */}
        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="AstikPoints" value={m.astik_points} accent />
            <Stat label="Arrivée" value={m.arrival_date ?? "—"} />
          </div>

          {isMember && <FactionBentoCard />}

          {isMember && <MonthlyRecapCard />}

          {isMember && <QuestsCard />}

          {isMember && <ObjectivesCard />}

          {isMember && <ActivityHeatmapCard />}
        </div>

        {/* Colonne secondaire : compte MC + activité */}
        <div className="space-y-6">
          <MinecraftAccountCard mcUuid={m.mc_uuid} igName={m.ig_name} />

          {isMember && <AbsencesCard />}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Dernière connexion
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {data.previousLoginAt ? (
                <div>
                  <span className="text-muted-foreground">Précédente :</span>{" "}
                  <span className="font-mono">
                    {new Date(data.previousLoginAt).toLocaleString("fr-FR")}
                  </span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Aucune connexion précédente enregistrée.
                </div>
              )}
              {data.currentLoginAt && (
                <div className="text-xs text-muted-foreground">
                  Session actuelle ouverte le{" "}
                  <span className="font-mono">
                    {new Date(data.currentLoginAt).toLocaleString("fr-FR")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

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

/** Statut membre traduit en français + pastille de couleur. */
const STATUS_META: Record<string, { label: string; dot: string }> = {
  active: { label: "Actif", dot: "bg-emerald-500" },
  trial: { label: "Période d'essai", dot: "bg-amber-500" },
  away: { label: "En pause", dot: "bg-sky-500" },
  former: { label: "Ancien", dot: "bg-zinc-500" },
  left: { label: "Parti", dot: "bg-zinc-500" },
  visitor: { label: "Visiteur", dot: "bg-zinc-500" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, dot: "bg-zinc-500" };
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </Badge>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
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
