// Approximate XP curves for Paladium jobs.
// NOTE: Real curves are not published; this uses a tunable polynomial that
// roughly matches in-game progression. Adjust BASE/EXP per job once verified.

export const JOBS = [
  { id: "miner", label: "Mineur" },
  { id: "lumberjack", label: "Bûcheron" },
  { id: "fisher", label: "Pêcheur" },
  { id: "hunter", label: "Chasseur" },
  { id: "farmer", label: "Fermier" },
  { id: "alchemist", label: "Alchimiste" },
  { id: "blacksmith", label: "Forgeron" },
] as const;

export type JobId = (typeof JOBS)[number]["id"];

// xpForLevel(n) = XP needed to reach level n from 0.
// Formula: base * level^exp — easy to recalibrate.
const PARAMS: Record<JobId, { base: number; exp: number }> = {
  miner: { base: 80, exp: 2.05 },
  lumberjack: { base: 80, exp: 2.05 },
  fisher: { base: 100, exp: 2.1 },
  hunter: { base: 120, exp: 2.1 },
  farmer: { base: 90, exp: 2.0 },
  alchemist: { base: 150, exp: 2.15 },
  blacksmith: { base: 150, exp: 2.15 },
};

export function xpForLevel(job: JobId, level: number): number {
  if (level <= 0) return 0;
  const p = PARAMS[job];
  return Math.round(p.base * Math.pow(level, p.exp));
}

export function xpBetween(job: JobId, from: number, to: number, currentXp = 0): number {
  if (to <= from) return 0;
  const need = xpForLevel(job, to) - xpForLevel(job, from);
  return Math.max(0, need - Math.max(0, currentXp));
}
