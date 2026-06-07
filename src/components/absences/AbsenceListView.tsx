/**
 * Vue Liste/Agenda : absences triées par date de fin croissante (les plus proches d'abord),
 * en cours en premier (badge pulsé). Réutilise AbsenceItem.
 */
import { useMemo } from "react";
import { EmptyState } from "@/components/EmptyState";
import { CalendarOff } from "lucide-react";
import { AbsenceItem } from "@/components/absences/AbsenceItem";
import { type AbsenceRow, isActiveOn } from "@/components/absences/types";

export function AbsenceListView({
  absences,
  canManage,
  myDiscordId,
  onChanged,
}: {
  absences: AbsenceRow[];
  canManage: boolean;
  myDiscordId?: string;
  onChanged: () => void;
}) {
  const sorted = useMemo(() => {
    const today = new Date();
    return [...absences].sort((a, b) => {
      const aActive = isActiveOn(a, today) ? 0 : 1;
      const bActive = isActiveOn(b, today) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (a.ends_on !== b.ends_on) return a.ends_on < b.ends_on ? -1 : 1;
      return a.starts_on < b.starts_on ? -1 : 1;
    });
  }, [absences]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="Aucune absence ne correspond"
        description="Ajuste les filtres ou déclare une nouvelle absence."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {sorted.map((a) => (
        <AbsenceItem
          key={a.id}
          absence={a}
          canManage={canManage}
          myDiscordId={myDiscordId}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}
