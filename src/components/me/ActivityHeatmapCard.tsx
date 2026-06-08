/**
 * Carte « Activité » — heatmap des jours de connexion façon GitHub (getMyActivityHeatmap).
 * Source : table logs (action=login). Intensité = nombre de connexions ce jour-là.
 * Ajout : labels mois + jours de semaine, total de connexions, série en cours / record.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Flame, Trophy, Zap } from "lucide-react";
import { getMyActivityHeatmap } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LEVELS = ["bg-muted", "bg-primary/30", "bg-primary/60", "bg-primary"];
const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
// 7 lignes = lundi → dimanche ; on n'étiquette qu'une ligne sur deux (façon GitHub).
const WEEKDAYS = ["Lun", "", "Mer", "", "Ven", "", ""];

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
  if (days.length === 0) return null;

  // --- Stats dérivées (calculées côté client à partir de la série) ---
  const counts = days.map((d) => d.count);
  const totalConnections = counts.reduce((a, b) => a + b, 0);
  let longestStreak = 0;
  let run = 0;
  for (const c of counts) {
    if (c > 0) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }
  let currentStreak = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if (counts[i] > 0) currentStreak += 1;
    else break;
  }

  // --- Grille hebdomadaire alignée sur le lundi ---
  const firstDow = (new Date(days[0].day).getDay() + 6) % 7; // 0 = lundi
  const cells: Array<{ day: string; count: number } | null> = [
    ...Array(firstDow).fill(null),
    ...days,
  ];
  const weeks: Array<Array<{ day: string; count: number } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Label de mois au-dessus de la 1re semaine de chaque mois.
  let prevMonth = -1;
  const monthLabels = weeks.map((week) => {
    const firstReal = week.find((c) => c !== null);
    if (!firstReal) return "";
    const month = new Date(firstReal.day).getMonth();
    if (month !== prevMonth) {
      prevMonth = month;
      return MONTHS[month];
    }
    return "";
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="size-4 text-primary" /> Activité
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {data.activeDays} jours actifs · 6 derniers mois
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé chiffré */}
        <div className="grid grid-cols-3 gap-2">
          <Mini icon={Zap} label="Connexions" value={totalConnections} />
          <Mini icon={Flame} label="Série en cours" value={`${currentStreak} j`} />
          <Mini icon={Trophy} label="Record" value={`${longestStreak} j`} />
        </div>

        {/* Heatmap */}
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1">
            {/* Ligne des mois */}
            <div className="flex gap-1">
              <div className="w-6 shrink-0" />
              {monthLabels.map((label, wi) => (
                <div
                  key={wi}
                  className="w-3 shrink-0 text-[10px] leading-none text-muted-foreground whitespace-nowrap"
                >
                  {label}
                </div>
              ))}
            </div>
            {/* Jours de semaine + cellules */}
            <div className="flex gap-1">
              <div className="flex w-6 shrink-0 flex-col gap-1 text-[10px] leading-none text-muted-foreground">
                {WEEKDAYS.map((d, i) => (
                  <div key={i} className="flex h-3 items-center">
                    {d}
                  </div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex shrink-0 flex-col gap-1">
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
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
