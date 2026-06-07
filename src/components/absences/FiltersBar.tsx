/**
 * Barre de filtres pour la vue absences : chips type, recherche membre,
 * toggle « uniquement actuelles » (couvre aujourd'hui).
 * Filtres entièrement client-side (sur la liste déjà chargée).
 */
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ABSENCE_TYPES, TYPE_META, type AbsenceType } from "@/components/absences/types";

export interface AbsencesFilters {
  types: Set<AbsenceType>;
  search: string;
  onlyActive: boolean;
}

export const ALL_TYPES_SET = new Set<AbsenceType>(ABSENCE_TYPES);

export function FiltersBar({
  filters,
  onChange,
}: {
  filters: AbsencesFilters;
  onChange: (next: AbsencesFilters) => void;
}) {
  const toggleType = (t: AbsenceType) => {
    const next = new Set(filters.types);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onChange({ ...filters, types: next });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {ABSENCE_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const on = filters.types.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                on ? meta.cls : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <span className={`size-2 rounded-full ${meta.dot}`} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Rechercher un membre…"
          className="pl-8 h-9"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.onlyActive}
          onChange={(e) => onChange({ ...filters, onlyActive: e.target.checked })}
        />
        <Label className="cursor-pointer">Uniquement actuelles</Label>
      </label>
    </div>
  );
}

/** Applique les filtres + tri (à venir/en cours d'abord, par fin croissante). */
export function applyFilters<
  T extends { type: string; member_name: string; starts_on: string; ends_on: string },
>(list: T[], filters: AbsencesFilters): T[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const search = filters.search.trim().toLowerCase();
  return list.filter((a) => {
    if (!filters.types.has(a.type as AbsenceType)) return false;
    if (search && !a.member_name.toLowerCase().includes(search)) return false;
    if (filters.onlyActive && !(a.starts_on <= todayIso && todayIso <= a.ends_on)) return false;
    return true;
  });
}
