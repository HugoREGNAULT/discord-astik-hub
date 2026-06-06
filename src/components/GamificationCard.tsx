/**
 * Carte d'affichage gamification (XP, niveau, streak, badges).
 * Lecture seule — alimentée par getMyGamification / getMemberGamification.
 * Micro-interactions : barre d'XP animée à l'arrivée + célébration au déblocage d'un badge.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { getMyGamification, getMemberGamification } from "@/lib/data/gamification.functions";

function criteriaLabel(c: { type?: string; gte?: number } | null): string {
  if (!c) return "Critère secret";
  switch (c.type) {
    case "first_donation":
      return "Effectuer un premier don validé";
    case "streak":
      return `Atteindre ${c.gte} jours d'activité consécutifs`;
    case "points_total":
      return `Cumuler ${c.gte} AstikPoints`;
    case "messages_total":
      return `Envoyer ${c.gte} messages`;
    case "xp":
      return `Atteindre ${c.gte} XP`;
    default:
      return "Critère personnalisé";
  }
}

// Clé localStorage : badges déjà vus par CE navigateur (scope "me" = un seul user).
const SEEN_BADGES_KEY = "pk-seen-badges";

export function GamificationCard({
  scope,
  discordId,
}: {
  scope: "me" | "member";
  discordId?: string;
}) {
  const myFn = useServerFn(getMyGamification);
  const memberFn = useServerFn(getMemberGamification);
  const { data, isLoading } = useQuery({
    queryKey: ["gamification", scope, discordId ?? "self"],
    queryFn: () => (scope === "me" ? myFn() : memberFn({ data: { discordId: discordId! } })),
    enabled: scope === "me" || !!discordId,
  });

  // Barre d'XP : démarre à 0 puis s'anime jusqu'à la valeur réelle au montage.
  const [animatedPct, setAnimatedPct] = useState(0);
  // Badges fraîchement débloqués → effet de célébration éphémère.
  const [celebrating, setCelebrating] = useState<Set<string>>(new Set());

  const progressPct = data?.progressPct ?? 0;
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedPct(progressPct));
    return () => cancelAnimationFrame(id);
  }, [progressPct]);

  // Détection des nouveaux badges (uniquement sur son propre profil).
  const earnedBadges = data?.earnedBadges;
  useEffect(() => {
    if (scope !== "me" || !earnedBadges || earnedBadges.length === 0) return;
    const earnedIds = earnedBadges.map((b) => b.id);
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(SEEN_BADGES_KEY) || "[]");
    } catch {
      stored = [];
    }
    const fresh = earnedIds.filter((id) => !stored.includes(id));
    try {
      localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(earnedIds));
    } catch {
      /* localStorage indispo — on ignore */
    }
    if (fresh.length === 0) return;
    setCelebrating(new Set(fresh));
    const names = earnedBadges.filter((b) => fresh.includes(b.id)).map((b) => b.name ?? "Badge");
    toast.success(
      fresh.length === 1
        ? `Badge débloqué : ${names[0]} 🎉`
        : `${fresh.length} nouveaux badges débloqués 🎉`,
    );
    const t = setTimeout(() => setCelebrating(new Set()), 2600);
    return () => clearTimeout(t);
  }, [scope, earnedBadges]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Progression
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Chargement…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <style>{`
        @keyframes pk-badge-celebrate {
          0%   { box-shadow: 0 0 0 0 rgba(236,72,153,.55); transform: scale(1); }
          25%  { transform: scale(1.14); }
          60%  { box-shadow: 0 0 14px 4px rgba(236,72,153,.65); }
          100% { box-shadow: 0 0 0 0 rgba(236,72,153,0); transform: scale(1); }
        }
        .pk-badge-celebrate { animation: pk-badge-celebrate 1.3s ease-out 2; }
        @media (prefers-reduced-motion: reduce) {
          .pk-badge-celebrate { animation: none; }
        }
      `}</style>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Progression
          </span>
          <UiBadge variant="secondary" className="gap-1">
            <Trophy className="h-3 w-3" /> Niveau {data.level}
          </UiBadge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{data.xp.toLocaleString("fr-FR")} XP</span>
            <span>
              {data.xpForNextLevel.toLocaleString("fr-FR")} XP — niv. {data.level + 1}
            </span>
          </div>
          <Progress
            value={animatedPct}
            className="[&>div]:transition-transform [&>div]:duration-1000 [&>div]:ease-out"
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Flame className="h-4 w-4 text-orange-500" />
          <span>
            Streak : <strong>{data.currentStreakDays}j</strong>{" "}
            <span className="text-muted-foreground">(record {data.longestStreakDays}j)</span>
          </span>
        </div>

        {data.earnedBadges.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Badges obtenus
            </div>
            <div className="flex flex-wrap gap-2">
              {data.earnedBadges.map((b, i) => (
                <span
                  key={b.id}
                  title={b.description ?? b.name ?? ""}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border animate-in fade-in zoom-in-50 fill-mode-both ${
                    celebrating.has(b.id) ? "pk-badge-celebrate" : ""
                  }`}
                  style={{
                    borderColor: b.color ?? undefined,
                    color: b.color ?? undefined,
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <span>{b.icon ?? "🏅"}</span>
                  <span>{b.name ?? "Badge"}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {data.lockedBadges.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              À débloquer
            </div>
            <div className="flex flex-wrap gap-2">
              {data.lockedBadges.map((b) => (
                <span
                  key={b.id}
                  title={criteriaLabel(b.criteria)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-dashed text-muted-foreground opacity-60"
                >
                  <span className="grayscale">{b.icon ?? "🔒"}</span>
                  <span>{b.name ?? "Badge"}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
