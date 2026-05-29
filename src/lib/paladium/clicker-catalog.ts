// Fallback catalog of PalaClicker buildings used when the API response
// doesn't include base cost / rps figures. Tunable.

export type CatalogEntry = {
  id: string;
  label: string;
  baseCost: number;
  baseRps: number;
  growth: number; // cost multiplier per purchase
};

export const CLICKER_CATALOG: CatalogEntry[] = [
  { id: "cursor", label: "Curseur", baseCost: 15, baseRps: 0.1, growth: 1.15 },
  { id: "grandma", label: "Mamie", baseCost: 100, baseRps: 1, growth: 1.15 },
  { id: "farm", label: "Ferme", baseCost: 1100, baseRps: 8, growth: 1.15 },
  { id: "mine", label: "Mine", baseCost: 12000, baseRps: 47, growth: 1.15 },
  { id: "factory", label: "Usine", baseCost: 130000, baseRps: 260, growth: 1.15 },
  { id: "bank", label: "Banque", baseCost: 1400000, baseRps: 1400, growth: 1.15 },
  { id: "temple", label: "Temple", baseCost: 20000000, baseRps: 7800, growth: 1.15 },
  { id: "wizard", label: "Tour de mage", baseCost: 330000000, baseRps: 44000, growth: 1.15 },
];

export function nextCost(entry: CatalogEntry, owned: number): number {
  return Math.ceil(entry.baseCost * Math.pow(entry.growth, owned));
}
