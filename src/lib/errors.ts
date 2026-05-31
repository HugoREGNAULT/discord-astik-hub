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
  FORBIDDEN_LEFT_GUILD:
    "Ton accès a été révoqué (tu n'es plus sur le serveur).",
  RATE_LIMITED: "Trop de requêtes, réessaie dans quelques secondes.",
};

const FALLBACK = "Une erreur est survenue, réessaie.";

export function toUserMessage(e: unknown): string {
  if (e instanceof AppError) return e.userMessage;
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg in ERROR_MESSAGES) {
      return ERROR_MESSAGES[msg];
    }
  }
  return FALLBACK;
}
