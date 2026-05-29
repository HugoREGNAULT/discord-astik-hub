// Average XP per action for each job. Tunable.
import type { JobId } from "./xp-curves";

export type XpAction = { label: string; xp: number };

export const RATES: Record<JobId, XpAction[]> = {
  miner: [
    { label: "Bloc de pierre", xp: 1 },
    { label: "Bloc de charbon", xp: 3 },
    { label: "Bloc de fer", xp: 5 },
    { label: "Bloc de diamant", xp: 25 },
  ],
  lumberjack: [
    { label: "Bûche de chêne", xp: 2 },
    { label: "Bûche de sapin", xp: 3 },
    { label: "Bûche d'acajou", xp: 6 },
  ],
  fisher: [
    { label: "Poisson commun", xp: 4 },
    { label: "Poisson rare", xp: 12 },
  ],
  hunter: [
    { label: "Animal passif", xp: 5 },
    { label: "Mob hostile", xp: 10 },
  ],
  farmer: [
    { label: "Blé", xp: 2 },
    { label: "Carotte / Patate", xp: 3 },
    { label: "Pastèque / Citrouille", xp: 5 },
  ],
  alchemist: [
    { label: "Potion mineure", xp: 8 },
    { label: "Potion majeure", xp: 20 },
  ],
  blacksmith: [
    { label: "Outil basique", xp: 6 },
    { label: "Outil avancé", xp: 18 },
  ],
};
