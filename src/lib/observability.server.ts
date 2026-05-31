/**
 * Reporting des erreurs serveur vers Discord (salon ERROR).
 * Fire-and-forget : ne throw jamais, n'attend pas le résultat réseau.
 */
import { COLORS, logToDiscord } from "@/lib/discord/log.server";
import { describeError } from "@/lib/error-capture";

export function reportError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  try {
    const { message, stack } = describeError(error);
    const body = (stack ?? message).slice(0, 1500);
    const fields = meta
      ? Object.entries(meta).map(([n, v]) => ({
          name: n,
          value: String(v).slice(0, 200),
          inline: true,
        }))
      : [];

    // fire-and-forget : on n'attend pas la promesse, on neutralise tout rejet
    void logToDiscord("error", {
      title: `❌ ${context}`,
      color: COLORS.danger,
      description: "```" + body + "```",
      fields,
    }).catch((e) => {
      console.error("[reportError] discord post failed", (e as Error)?.message);
    });
  } catch (e) {
    console.error("[reportError] internal error", (e as Error)?.message);
  }
}
