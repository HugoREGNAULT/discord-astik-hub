/**
 * Envoi de logs dans les salons Discord (serveur faction).
 * Utilise le bot token. Silencieux en cas d'erreur (ne casse jamais l'appelant).
 */
import { DISCORD_API, LOG_CHANNELS } from "./constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!;

type Embed = {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
};

async function postToChannel(
  channelId: string,
  payload: { content?: string; embeds?: Embed[] },
): Promise<void> {
  try {
    if (!process.env.DISCORD_BOT_TOKEN) return;
    const res = await fetchWithRetry(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("[discord log] failed", channelId, res.status, await res.text());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[discord log] error", (e as Error).message);
  }
}

export type LogKind = "auth" | "site";

export function logToDiscord(
  kind: LogKind,
  embed: Embed,
): Promise<void> {
  const channel = kind === "auth" ? LOG_CHANNELS.AUTH : LOG_CHANNELS.SITE;
  return postToChannel(channel, {
    embeds: [{ timestamp: new Date().toISOString(), ...embed }],
  });
}

export const COLORS = {
  success: 0x22c55e,
  info: 0x3b82f6,
  warn: 0xf59e0b,
  danger: 0xef4444,
  neutral: 0x6b7280,
} as const;
