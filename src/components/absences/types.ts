/**
 * Types + métadonnées partagés entre les composants de la page /absences.
 * TYPE_META : libellé + icône + classes de couleur par type d'absence.
 * Helpers dates : opérations sur Date locales + format ISO YYYY-MM-DD.
 */
import { Plane, Home as HomeIcon, Stethoscope, HelpCircle, type LucideIcon } from "lucide-react";

export type AbsenceType = "vacation" | "irl" | "illness" | "other";

export const TYPE_META: Record<
  AbsenceType,
  { label: string; icon: LucideIcon; cls: string; dot: string; bar: string }
> = {
  vacation: {
    label: "Vacances",
    icon: Plane,
    cls: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    dot: "bg-sky-500",
    bar: "bg-sky-500/70 hover:bg-sky-500 border-sky-500",
  },
  irl: {
    label: "IRL",
    icon: HomeIcon,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
    bar: "bg-amber-500/70 hover:bg-amber-500 border-amber-500",
  },
  illness: {
    label: "Maladie",
    icon: Stethoscope,
    cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
    bar: "bg-rose-500/70 hover:bg-rose-500 border-rose-500",
  },
  other: {
    label: "Autre",
    icon: HelpCircle,
    cls: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    bar: "bg-muted-foreground/60 hover:bg-muted-foreground border-muted-foreground",
  },
};

export const ABSENCE_TYPES: AbsenceType[] = ["vacation", "irl", "illness", "other"];

/** Forme enrichie renvoyée par listAbsences (back-end). */
export interface AbsenceRow {
  id: string;
  member_discord_id: string;
  type: string;
  reason: string | null;
  starts_on: string;
  ends_on: string;
  created_at: string;
  member_name: string;
  member_avatar: string | null;
  member_mc_uuid: string | null;
}

/* ---------- Helpers dates (toutes en heure locale) ---------- */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - day);
  return out;
}
export function endOfWeek(d: Date): Date {
  const out = startOfWeek(d);
  out.setDate(out.getDate() + 6);
  return out;
}
export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Différence en jours entre deux dates ISO (inclusive : startsOn == endsOn => 1 jour). */
export function daysBetween(startsOn: string, endsOn: string): number {
  const s = parseISODate(startsOn).getTime();
  const e = parseISODate(endsOn).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

/** Vrai si l'absence couvre `day` (inclusive sur starts_on et ends_on). */
export function isActiveOn(a: { starts_on: string; ends_on: string }, day: Date): boolean {
  const iso = toISODate(day);
  return a.starts_on <= iso && iso <= a.ends_on;
}
