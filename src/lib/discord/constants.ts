/**
 * Discord IDs — PunkAstik / Paladium
 * Source: spec from user. Single source of truth, never hardcode elsewhere.
 */

export const GUILDS = {
  PUBLIC: "1484137253612814426",
  FACTION: "1502936959050321953",
} as const;

export const ROLES = {
  /** Staff faction — haut staff sur serveur privé */
  STAFF_FACTION: "1503083799540404255",
  /** Staff dons / points / config */
  STAFF_POINTS: "1505555444373127188",
  /** Staff ticket */
  STAFF_TICKET: "1503077087160828066",
  /** Recruteur serveur public */
  RECRUITER_PUBLIC: "1485381120014024876",
  /** Membre faction */
  MEMBER_FACTION: "1503030823174148216",
  /** Haut staff sur serveur public */
  HIGH_STAFF_PUBLIC: "1485420835165569146",
  /** Candidature acceptée — en attente d'entretien (serveur public) */
  INTERVIEW_PENDING_PUBLIC: "1487627885027266611",
} as const;

/**
 * Grades faction dans l'ordre hiérarchique exact (du plus haut au plus bas).
 * NOTE: les IDs de rôles par grade ne sont pas fournis dans la spec — le
 * dashboard utilisera le nom du rôle Discord (case-insensitive) jusqu'à ce
 * que les IDs soient fournis. Ajustables dans EFFECTIF_GRADES.
 */
export const EFFECTIF_GRADES: { label: string; matchNames: string[] }[] = [
  { label: "Leader", matchNames: ["leader"] },
  { label: "Bras droits", matchNames: ["bras droit", "bras droits"] },
  { label: "Lieutenant", matchNames: ["lieutenant"] },
  { label: "Aspirant", matchNames: ["aspirant"] },
  { label: "Major", matchNames: ["major"] },
  { label: "Adjudant", matchNames: ["adjudant"] },
  { label: "Recruteur", matchNames: ["recruteur"] },
  { label: "Sergent", matchNames: ["sergent"] },
  { label: "Caporal", matchNames: ["caporal"] },
  { label: "Soldat", matchNames: ["soldat"] },
  { label: "Bleu", matchNames: ["bleu", "bleus"] },
];

export const DISCORD_API = "https://discord.com/api/v10";
export const DISCORD_OAUTH_SCOPES = ["identify", "guilds", "guilds.members.read"];

/** Salons de logs sur le serveur faction */
export const LOG_CHANNELS = {
  AUTH: "1509547507640701081",
  SITE: "1509547529384235178",
  SHOP_ALERTS: "1510047242646454272",
  /** Salon des erreurs serveur — surchargeable via env DISCORD_LOG_CHANNEL_ERROR */
  ERROR: "",
} as const;
