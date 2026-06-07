/**
 * Calendrier mensuel avec :
 * - Barres multi-jours qui traversent les jours d'une même semaine (1 trait par absence,
 *   au lieu de répéter le pseudo dans chaque case).
 * - Clic sur n'importe quelle cellule → modal listant TOUTES les absences ce jour-là.
 * - Le jour « aujourd'hui » est mis en évidence.
 *
 * Algo : pour chaque ligne de 7 jours, on découpe les absences en segments couvrant la
 * semaine, puis on les empile par « slot » via un greedy first-fit (1 segment par slot
 * sans collision). Au-delà de MAX_BARS, un « +N » résume le reste.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  toISODate,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  sameDay,
  TYPE_META,
  ABSENCE_TYPES,
  type AbsenceRow,
  type AbsenceType,
} from "@/components/absences/types";
import { DayDetailsDialog } from "@/components/absences/DayDetailsDialog";

const MAX_BARS_PER_WEEK = 4;

interface Segment {
  absence: AbsenceRow;
  weekStartIdx: number; // 0..6
  weekEndIdx: number; // 0..6 (inclusif)
  slot: number;
}

/** Pour une semaine donnée, calcule les segments + slots greedy first-fit. */
function buildWeekSegments(absences: AbsenceRow[], weekDays: Date[]): Segment[] {
  const weekStartIso = toISODate(weekDays[0]);
  const weekEndIso = toISODate(weekDays[6]);

  // Garder les absences qui touchent la semaine, triées par début puis durée desc
  const touching = absences
    .filter((a) => a.starts_on <= weekEndIso && a.ends_on >= weekStartIso)
    .sort((a, b) => {
      if (a.starts_on !== b.starts_on) return a.starts_on < b.starts_on ? -1 : 1;
      return a.ends_on < b.ends_on ? 1 : -1;
    });

  // Pour chaque slot, on garde l'indice de fin (inclusif) du dernier segment placé.
  const slotEnd: number[] = [];
  const segments: Segment[] = [];

  for (const a of touching) {
    const s = a.starts_on > weekStartIso ? a.starts_on : weekStartIso;
    const e = a.ends_on < weekEndIso ? a.ends_on : weekEndIso;
    const startIdx = weekDays.findIndex((d) => toISODate(d) === s);
    const endIdx = weekDays.findIndex((d) => toISODate(d) === e);
    if (startIdx < 0 || endIdx < 0) continue;

    let slot = slotEnd.findIndex((end) => end < startIdx);
    if (slot === -1) {
      slot = slotEnd.length;
      slotEnd.push(endIdx);
    } else {
      slotEnd[slot] = endIdx;
    }
    segments.push({ absence: a, weekStartIdx: startIdx, weekEndIdx: endIdx, slot });
  }
  return segments;
}

export function MonthCalendar({
  absences,
  cursor,
  onCursorChange,
}: {
  absences: AbsenceRow[];
  cursor: Date;
  onCursorChange: (d: Date) => void;
}) {
  const [dayDetail, setDayDetail] = useState<Date | null>(null);

  const gridStart = startOfWeek(startOfMonth(cursor));
  const gridEnd = endOfWeek(endOfMonth(cursor));

  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [gridStart, gridEnd]);

  // 7 jours par ligne
  const weeks: Date[][] = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Compteurs par type sur le mois courant
  const monthCounts = useMemo(() => {
    const monthStart = toISODate(startOfMonth(cursor));
    const monthEnd = toISODate(endOfMonth(cursor));
    const set: Record<string, Set<string>> = {};
    for (const t of ABSENCE_TYPES) set[t] = new Set<string>();
    for (const a of absences) {
      if (a.starts_on <= monthEnd && a.ends_on >= monthStart && a.type in set) {
        set[a.type].add(a.id);
      }
    }
    return set;
  }, [absences, cursor]);

  // Liste des absences du jour ouvert dans la modal (cliquant cellule)
  const dayDetailList = useMemo(() => {
    if (!dayDetail) return [];
    const iso = toISODate(dayDetail);
    return absences
      .filter((a) => a.starts_on <= iso && iso <= a.ends_on)
      .sort((a, b) => a.member_name.localeCompare(b.member_name));
  }, [absences, dayDetail]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCursorChange(startOfMonth(new Date()))}
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className="px-1 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Une grille CSS 2D par semaine : 7 colonnes × (1 row d'en-tête jour + N slots de barres + 1 row +N).
            Tout est placé via gridColumn/gridRow, plus aucun position:absolute → les barres respectent leurs jours. */}
        <div className="space-y-1">
          {weeks.map((weekDays, wi) => {
            const segments = buildWeekSegments(absences, weekDays);
            const shown = segments.filter((s) => s.slot < MAX_BARS_PER_WEEK);
            const hiddenByDay: number[] = new Array(7).fill(0);
            for (const s of segments) {
              if (s.slot >= MAX_BARS_PER_WEEK) {
                for (let i = s.weekStartIdx; i <= s.weekEndIdx; i++) hiddenByDay[i]++;
              }
            }
            // Hauteur des rows : numéro / 4 slots barres / +N. minmax(0,…) empêche le contenu d'étirer la row.
            const gridTemplateRows = `minmax(0, 1.5rem) repeat(${MAX_BARS_PER_WEEK}, minmax(0, 1.5rem)) minmax(0, 1rem)`;
            return (
              <div key={wi} className="grid grid-cols-7 gap-1" style={{ gridTemplateRows }}>
                {/* Fond cliquable par jour — span toutes les rows, sans contenu (le numéro est rendu à part). */}
                {weekDays.map((d, i) => {
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const isToday = sameDay(d, today);
                  return (
                    <button
                      key={`bg-${toISODate(d)}`}
                      type="button"
                      onClick={() => setDayDetail(d)}
                      style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                      className={`border rounded-md transition-colors min-w-0 ${
                        inMonth
                          ? "bg-card hover:bg-accent/40"
                          : "bg-muted/30 opacity-60 hover:opacity-100"
                      } ${isToday ? "border-primary/60 ring-1 ring-primary/30" : "border-border"}`}
                      aria-label={`Voir les absences du ${d.toLocaleDateString("fr-FR")}`}
                    />
                  );
                })}

                {/* Numéro du jour — séparé du fond, en row 1, non cliquable (le clic descend au fond). */}
                {weekDays.map((d, i) => {
                  const isToday = sameDay(d, today);
                  return (
                    <span
                      key={`num-${toISODate(d)}`}
                      style={{ gridColumn: i + 1, gridRow: 1 }}
                      className={`pointer-events-none relative z-20 px-1 pt-0.5 text-[10px] font-medium leading-none ${
                        isToday ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  );
                })}

                {/* Barres multi-jours — gridColumn span + gridRow slot. z-10 pour passer au-dessus du fond. */}
                {shown.map((seg) => {
                  const meta = TYPE_META[seg.absence.type as AbsenceType] ?? TYPE_META.other;
                  const span = seg.weekEndIdx - seg.weekStartIdx + 1;
                  return (
                    <button
                      key={`${seg.absence.id}-${wi}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDayDetail(weekDays[seg.weekStartIdx]);
                      }}
                      style={{
                        gridColumnStart: seg.weekStartIdx + 1,
                        gridColumnEnd: `span ${span}`,
                        gridRow: 2 + seg.slot,
                      }}
                      className={`relative z-10 mx-0.5 self-center min-w-0 text-[10px] leading-tight px-1.5 py-0.5 rounded border text-white truncate text-left ${meta.bar}`}
                      title={`${seg.absence.member_name} — ${meta.label} (${seg.absence.starts_on} → ${seg.absence.ends_on})`}
                    >
                      {seg.absence.member_name}
                    </button>
                  );
                })}

                {/* « +N » sur la dernière row pour les jours qui cachent des absences. */}
                {hiddenByDay.map((n, i) =>
                  n > 0 ? (
                    <button
                      key={`more-${wi}-${i}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDayDetail(weekDays[i]);
                      }}
                      style={{ gridColumn: i + 1, gridRow: -2 }}
                      className="relative z-10 mx-1 text-[10px] text-muted-foreground hover:text-foreground text-left leading-none"
                    >
                      +{n}
                    </button>
                  ) : null,
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {ABSENCE_TYPES.map((k) => {
            const v = TYPE_META[k];
            const count = monthCounts[k]?.size ?? 0;
            return (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${v.dot}`} />
                {v.label} <span className="font-mono text-foreground">{count}</span>
              </span>
            );
          })}
        </div>
      </CardContent>

      <DayDetailsDialog
        day={dayDetail}
        absences={dayDetailList}
        onClose={() => setDayDetail(null)}
      />
    </Card>
  );
}
