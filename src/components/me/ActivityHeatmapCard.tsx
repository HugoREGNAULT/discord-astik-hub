/**
 * Carte « Activité » — heatmap des jours de connexion façon GitHub (getMyActivityHeatmap).
 * Source : table logs (action=login). Intensité = nombre de connexions ce jour-là.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { getMyActivityHeatmap } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LEVELS = ["bg-muted", "bg-primary/30", "bg-primary/60", "bg-primary"];

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

export function ActivityHeatmapCard() {
  const fn = useServerFn(getMyActivityHeatmap);
  const { data } = useQuery({
    queryKey: ["me", "heatmap"],
    queryFn: () => fn({ data: { days: 182 } }),
  });

  if (!data) return null;
  const days = data.heatmap;

  // Aligne la 1re colonne sur un lundi (cellules de padding au début).
  const firstDow = (new Date(days[0].day).getDay() + 6) % 7; // 0 = lundi
  const cells: Array<{ day: string; count: number } | null> = [
    ...Array(firstDow).fill(null),
    ...days,
  ];
  const weeks: Array<Array<{ day: string; count: number } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="size-4 text-primary" /> Activité
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {data.activeDays} jours actifs
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell, di) =>
                  cell ? (
                    <div
                      key={cell.day}
                      className={`size-3 rounded-sm ${LEVELS[level(cell.count)]}`}
                      title={`${new Date(cell.day).toLocaleDateString("fr-FR")} — ${cell.count} connexion${cell.count > 1 ? "s" : ""}`}
                    />
                  ) : (
                    <div key={`pad-${wi}-${di}`} className="size-3 rounded-sm" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
          <span>Moins</span>
          {LEVELS.map((c, i) => (
            <div key={i} className={`size-3 rounded-sm ${c}`} />
          ))}
          <span>Plus</span>
        </div>
      </CardContent>
    </Card>
  );
}
