/**
 * Carte d'affichage gamification (XP, niveau, streak, badges).
 * Lecture seule — alimentée par getMyGamification / getMemberGamification.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Flame, Sparkles, Trophy } from "lucide-react";
import {
  getMyGamification,
  getMemberGamification,
} from "@/lib/data/gamification.functions";

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
    queryFn: () =>
      scope === "me"
        ? myFn()
        : memberFn({ data: { discordId: discordId! } }),
    enabled: scope === "me" || !!discordId,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Progression
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Chargement…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
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
              {data.xpForNextLevel.toLocaleString("fr-FR")} XP — niv.{" "}
              {data.level + 1}
            </span>
          </div>
          <Progress value={data.progressPct} />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Flame className="h-4 w-4 text-orange-500" />
          <span>
            Streak : <strong>{data.currentStreakDays}j</strong>{" "}
            <span className="text-muted-foreground">
              (record {data.longestStreakDays}j)
            </span>
          </span>
        </div>

        {data.earnedBadges.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Badges obtenus
            </div>
            <div className="flex flex-wrap gap-2">
              {data.earnedBadges.map((b) => (
                <span
                  key={b.id}
                  title={b.description ?? b.name ?? ""}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border"
                  style={{
                    borderColor: b.color ?? undefined,
                    color: b.color ?? undefined,
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
