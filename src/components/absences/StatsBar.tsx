/**
 * Barre d'infos compacte en haut de la page absences :
 * « N absents aujourd'hui · M cette semaine · K reprennent ≤3j ».
 * Tout est calculé côté client sur la liste déjà chargée par listAbsences.
 */
import { useMemo } from "react";
import { Users, CalendarDays, CalendarCheck } from "lucide-react";
import { toISODate, addDays, type AbsenceRow } from "@/components/absences/types";

export function StatsBar({ absences }: { absences: AbsenceRow[] }) {
  const stats = useMemo(() => {
    const today = new Date();
    const todayIso = toISODate(today);
    const in3DaysIso = toISODate(addDays(today, 3));
    const in7DaysIso = toISODate(addDays(today, 7));

    const activeToday = new Set<string>();
    const thisWeek = new Set<string>();
    const returningSoon = new Set<string>();

    for (const a of absences) {
      // Couvre aujourd'hui ?
      if (a.starts_on <= todayIso && todayIso <= a.ends_on) {
        activeToday.add(a.member_discord_id);
      }
      // Couvre au moins un jour entre today et today+7 ?
      if (a.starts_on <= in7DaysIso && a.ends_on >= todayIso) {
        thisWeek.add(a.member_discord_id);
      }
      // Reprend dans les 3 prochains jours (fin entre today et today+3, en cours aujourd'hui) ?
      if (a.starts_on <= todayIso && a.ends_on >= todayIso && a.ends_on <= in3DaysIso) {
        returningSoon.add(a.member_discord_id);
      }
    }

    return {
      activeToday: activeToday.size,
      thisWeek: thisWeek.size,
      returningSoon: returningSoon.size,
    };
  }, [absences]);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Tile
        icon={Users}
        value={stats.activeToday}
        label="absents aujourd'hui"
        accent={stats.activeToday > 0}
      />
      <Tile icon={CalendarDays} value={stats.thisWeek} label="cette semaine" />
      <Tile
        icon={CalendarCheck}
        value={stats.returningSoon}
        label="reprennent dans ≤ 3 j"
        accentColor="text-emerald-500"
      />
    </div>
  );
}

function Tile({
  icon: Icon,
  value,
  label,
  accent,
  accentColor = "text-primary",
}: {
  icon: typeof Users;
  value: number;
  label: string;
  accent?: boolean;
  accentColor?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 flex items-center gap-3">
      <Icon className={`size-4 shrink-0 ${accent ? accentColor : "text-muted-foreground"}`} />
      <div>
        <div className={`text-xl font-bold ${accent ? accentColor : ""}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground -mt-0.5">{label}</div>
      </div>
    </div>
  );
}
