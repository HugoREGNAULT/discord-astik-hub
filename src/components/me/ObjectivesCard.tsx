/**
 * Carte « Objectifs de faction » — objectifs actifs + contribution du membre connecté.
 * Lecture seule (getMyObjectives). Masquée s'il n'y a aucun objectif actif.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target } from "lucide-react";
import { getMyObjectives } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ObjectivesCard() {
  const fn = useServerFn(getMyObjectives);
  const { data } = useQuery({
    queryKey: ["me", "objectives"],
    queryFn: () => fn(),
  });

  const objectives = data?.objectives ?? [];
  if (objectives.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4 text-primary" /> Objectifs de faction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {objectives.map((o) => {
          const target = o.target_value ?? 0;
          const current = o.current_value ?? 0;
          const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
          const mine = data?.myContributions[o.id] ?? 0;
          return (
            <div key={o.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium">{o.title}</span>
                {o.reward_points > 0 && (
                  <span className="text-xs text-primary font-mono shrink-0">
                    +{o.reward_points} AP
                  </span>
                )}
              </div>
              {target > 0 && (
                <>
                  <Progress value={pct} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>
                      {current.toLocaleString("fr-FR")} / {target.toLocaleString("fr-FR")}
                      {o.unit ? ` ${o.unit}` : ""}
                    </span>
                    {mine > 0 && (
                      <span className="text-primary">
                        ma contribution : {mine.toLocaleString("fr-FR")}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
