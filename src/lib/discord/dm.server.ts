/**
 * Envoi de DM Discord via le bot.
 * 1) POST /users/@me/channels { recipient_id }  -> récupère le channel DM
 * 2) POST /channels/{id}/messages { content }
 */
import { DISCORD_API } from "./constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

const BOT_TOKEN = () => process.env.DISCORD_BOT_TOKEN!;

export async function sendDiscordDM(
  userId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const dmRes = await fetchWithRetry(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!dmRes.ok) {
      return { ok: false, error: `DM create failed: ${dmRes.status}` };
    }
    const dm = (await dmRes.json()) as { id: string };

    const msgRes = await fetchWithRetry(`${DISCORD_API}/channels/${dm.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    if (!msgRes.ok) {
      return { ok: false, error: `DM send failed: ${msgRes.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
