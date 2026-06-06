/**
 * Carte « Prochain grade » — progression du membre connecté vers le grade suivant.
 * Lecture seule (getMyRankupProgress). Ne s'affiche que si des seuils de grade sont configurés.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Trophy } from "lucide-react";
import { getMyRankupProgress } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function Req({ label, have, need }: { label: string; have: number; need: number }) {
  if (need <= 0) return null;
  const ok = have >= need;
  const pct = Math.min(100, Math.round((have / need) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={ok ? "text-emerald-500" : "text-muted-foreground"}>
          {ok ? "✓ " : ""}
          {label}
        </span>
        <span className="font-mono text-muted-foreground">
          {have} / {need}
        </span>
      </div>
      <Progress value={pct} className={ok ? "[&>div]:bg-emerald-500" : ""} />
    </div>
  );
}

export function RankupProgressCard() {
  const fn = useServerFn(getMyRankupProgress);
  const { data } = useQuery({
    queryKey: ["me", "rankup"],
    queryFn: () => fn(),
  });

  if (!data || !data.configured) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" /> Progression de grade
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.isMax ? (
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="size-4 text-amber-500" />
            Tu es au grade le plus élevé. Bravo !
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Prochain grade :</span>{" "}
              <span className="font-semibold text-primary">{data.nextGrade}</span>
            </div>
            <div className="space-y-3">
              <Req
                label="AstikPoints"
                have={data.requirements.points.have}
                need={data.requirements.points.need}
              />
              <Req
                label="Jours dans la faction"
                have={data.requirements.daysInFaction.have}
                need={data.requirements.daysInFaction.need}
              />
              <Req
                label="Messages (7j)"
                have={data.requirements.messages7d.have}
                need={data.requirements.messages7d.need}
              />
              <Req
                label="Vocal 7j (h)"
                have={data.requirements.voice7dHours.have}
                need={data.requirements.voice7dHours.need}
              />
              <Req
                label="Jours depuis le dernier up"
                have={data.requirements.daysSinceRankup.have}
                need={data.requirements.daysSinceRankup.need}
              />
            </div>
            {data.allMet && (
              <p className="text-xs text-emerald-500">
                Tu remplis toutes les conditions — un staff validera ton passage de grade.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
