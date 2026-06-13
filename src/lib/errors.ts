/**
 * Erreurs applicatives + traduction des codes serveur en messages FR
 * destinés à l'utilisateur final (toasts, etc.).
 *
 * Règle : ne JAMAIS afficher tel quel un message d'erreur brut
 * (code technique, message SQL, stack). Toujours passer par toUserMessage().
 */

export class AppError extends Error {
  code: string;
  httpStatus: number;
  userMessage: string;

  constructor(code: string, httpStatus: number, userMessage: string) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.userMessage = userMessage;
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Tu n'as pas les droits pour effectuer cette action.",
  UNAUTHENTICATED: "Session expirée, reconnecte-toi avec Discord.",
  FORBIDDEN_LEFT_GUILD: "Ton accès a été révoqué (tu n'es plus sur le serveur).",
  RATE_LIMITED: "Trop de requêtes, réessaie dans quelques secondes.",
};

const FALLBACK = "Une erreur est survenue, réessaie.";

/**
 * Marqueur (invisible) préfixant les messages d'erreur explicitement destinés à
 * l'utilisateur final. Indispensable parce que `instanceof AppError` ne survit
 * PAS à la sérialisation server→client d'une server function : seul le `.message`
 * brut traverse la frontière. Un message marqué peut donc être affiché tel quel
 * en toute sécurité (texte rédigé pour l'utilisateur, jamais un détail technique),
 * tout en laissant les erreurs non marquées (SQL, stack, exceptions inattendues)
 * retomber sur le message générique.
 */
const USER_MSG_PREFIX = "​"; // zero-width space

/** Crée une erreur dont le message sera affiché tel quel au client. */
export function userError(message: string): Error {
  return new Error(USER_MSG_PREFIX + message);
}

/** Retire le marqueur d'un message (pour les logs serveur). */
export function stripUserMsgPrefix(message: string): string {
  return message.startsWith(USER_MSG_PREFIX) ? message.slice(USER_MSG_PREFIX.length) : message;
}

export function toUserMessage(e: unknown): string {
  if (e instanceof AppError) return e.userMessage;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") {
      if (msg.startsWith(USER_MSG_PREFIX)) return msg.slice(USER_MSG_PREFIX.length);
      if (msg in ERROR_MESSAGES) return ERROR_MESSAGES[msg];
    }
  }
  return FALLBACK;
}
