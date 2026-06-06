/**
 * Carte « Quêtes de la semaine » (vue membre) — progression sur les quêtes actives
 * + réclamation de la récompense en AstikPoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Swords, Check } from "lucide-react";
import { getMyQuests, claimQuestReward } from "@/lib/data/quests.functions";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const UNIT: Record<string, string> = {
  messages: "messages",
  voice_hours: "h vocal",
  donation_points: "AP donnés",
  points_earned: "AP gagnés",
};

export function QuestsCard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(getMyQuests);
  const claimFn = useServerFn(claimQuestReward);

  const { data } = useQuery({
    queryKey: ["me", "quests"],
    queryFn: () => listFn(),
  });

  const claimMut = useMutation({
    mutationFn: (templateId: string) => claimFn({ data: { templateId } }),
    onSuccess: (r) => {
      toast.success(`Récompense réclamée : +${r.reward} AstikPoints 🎉`);
      queryClient.invalidateQueries({ queryKey: ["me", "quests"] });
      queryClient.invalidateQueries({ queryKey: ["me", "overview"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const quests = data?.quests ?? [];
  if (quests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="size-4 text-primary" /> Quêtes de la semaine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quests.map((q) => {
          const pct = q.target > 0 ? Math.min(100, Math.round((q.current / q.target) * 100)) : 0;
          return (
            <div key={q.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium">{q.title}</span>
                <span className="text-xs text-primary font-mono shrink-0">+{q.reward} AP</span>
              </div>
              {q.description && (
                <p className="text-xs text-muted-foreground mb-1.5">{q.description}</p>
              )}
              <Progress value={pct} className={q.completed ? "[&>div]:bg-emerald-500" : ""} />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {q.current.toLocaleString("fr-FR")} / {q.target.toLocaleString("fr-FR")}{" "}
                  {UNIT[q.quest_type] ?? ""}
                </span>
                {q.claimed ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" /> Réclamée
                  </Badge>
                ) : q.completed ? (
                  <Button
                    size="sm"
                    onClick={() => claimMut.mutate(q.id)}
                    disabled={claimMut.isPending}
                  >
                    Réclamer +{q.reward}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
