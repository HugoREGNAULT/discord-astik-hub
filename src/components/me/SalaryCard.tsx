/**
 * Carte « Mon salaire » — salaire hebdo (selon grade) + historique des versements.
 * Lecture seule (getMySalary). Masquée si aucun salaire configuré et aucun historique.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet } from "lucide-react";
import { getMySalary } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SalaryCard() {
  const fn = useServerFn(getMySalary);
  const { data } = useQuery({
    queryKey: ["me", "salary"],
    queryFn: () => fn(),
  });

  if (!data) return null;
  const { weeklyPoints, history } = data;
  if (weeklyPoints === null && history.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="size-4 text-primary" /> Mon salaire
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {weeklyPoints !== null ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">
                {weeklyPoints.toLocaleString("fr-FR")}
                <span className="text-sm font-normal text-muted-foreground"> AP / semaine</span>
              </div>
              {data.minActivitySeconds > 0 && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Activité requise : {Math.round(data.minActivitySeconds / 3600)} h vocal / 7j
                </div>
              )}
            </div>
            <Badge variant={data.eligible ? "secondary" : "outline"} className="gap-1.5">
              <span
                className={`size-2 rounded-full ${data.eligible ? "bg-emerald-500" : "bg-amber-500"}`}
                aria-hidden
              />
              {data.eligible ? "Éligible" : "Activité insuffisante"}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun salaire configuré pour ton grade actuel.
          </p>
        )}

        {history.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Derniers versements
            </div>
            <ul className="space-y-1.5">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    +{h.amount.toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
