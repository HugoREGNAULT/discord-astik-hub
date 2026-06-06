/**
 * Tags de rôle / spécialité d'un membre, partagés serveur (validation) et client (affichage).
 * Source unique de vérité pour la liste blanche des rôles du profil /me.
 */
export const ROLE_TAGS = [
  { id: "pvp", label: "PvP", icon: "⚔️" },
  { id: "builder", label: "Builder", icon: "🏗️" },
  { id: "farmer", label: "Farmer", icon: "🌾" },
  { id: "miner", label: "Mineur", icon: "⛏️" },
  { id: "redstone", label: "Redstone", icon: "🧱" },
  { id: "grind", label: "Grind", icon: "💎" },
  { id: "staff", label: "Staff", icon: "🛡️" },
  { id: "recruteur", label: "Recruteur", icon: "🤝" },
  { id: "designer", label: "Designer", icon: "🎨" },
  { id: "dev", label: "Dev", icon: "💻" },
] as const;

/** Élargi en string[] pour les contrôles d'appartenance (Array.includes côté serveur). */
export const ROLE_TAG_IDS: string[] = ROLE_TAGS.map((r) => r.id);
export const MAX_ROLE_TAGS = 4;
export const MAX_BIO_LENGTH = 280;

export function roleLabel(id: string): string {
  return ROLE_TAGS.find((r) => r.id === id)?.label ?? id;
}
export function roleIcon(id: string): string {
  return ROLE_TAGS.find((r) => r.id === id)?.icon ?? "🏷️";
}
