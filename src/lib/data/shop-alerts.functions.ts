/**
 * Alertes prix shop admin Paladium.
 * Un membre crée une alerte (item, type achat/vente, direction au-dessus/en-dessous, seuil).
 * Après chaque snapshot, on évalue les alertes armées et on envoie une mention
 * dans le salon SHOP_ALERTS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSession } from "@/lib/auth/require.server";
import { DISCORD_API, LOG_CHANNELS } from "@/lib/discord/constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export interface ShopAlertRow {
  id: string;
  user_discord_id: string;
  user_username: string | null;
  item_name: string;
  price_type: "buy" | "sell";
  direction: "above" | "below";
  threshold: number;
  is_triggered: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export const listMyShopAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const { data, error } = await db
    .from("shop_admin_price_alerts")
    .select("*")
    .eq("user_discord_id", user.discordId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { alerts: (data ?? []) as ShopAlertRow[] };
});

export const createShopAlert = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      item_name: z.string().min(1).max(255),
      price_type: z.enum(["buy", "sell"]),
      direction: z.enum(["above", "below"]),
      threshold: z.number().positive().max(1_000_000_000),
    }).parse,
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { error } = await db.from("shop_admin_price_alerts").insert({
      user_discord_id: user.discordId,
      user_username: user.username,
      item_name: data.item_name,
      price_type: data.price_type,
      direction: data.direction,
      threshold: data.threshold,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShopAlert = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { error } = await db
      .from("shop_admin_price_alerts")
      .delete()
      .eq("id", data.id)
      .eq("user_discord_id", user.discordId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============= Évaluation (appelée après chaque snapshot) ============= */

async function postAlertMessage(content: string): Promise<void> {
  if (!process.env.DISCORD_BOT_TOKEN) return;
  try {
    const res = await fetchWithRetry(
      `${DISCORD_API}/channels/${LOG_CHANNELS.SHOP_ALERTS}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          allowed_mentions: { parse: ["users"] },
        }),
      },
    );
    if (!res.ok) {
      console.error("[shop-alerts] post failed", res.status, await res.text());
    }
  } catch (e) {
    console.error("[shop-alerts] post error", (e as Error).message);
  }
}

/**
 * Évalue toutes les alertes contre la dernière photo des prix.
 * - Si la condition est vraie ET l'alerte est armée → envoie le message + marque triggered
 * - Si la condition est fausse ET l'alerte est triggered → ré-arme automatiquement
 */
export async function evaluateShopAlerts(): Promise<{ fired: number; rearmed: number }> {
  const { data: alerts, error: aerr } = await db
    .from("shop_admin_price_alerts")
    .select("*");
  if (aerr) throw new Error(aerr.message);
  const list = (alerts ?? []) as ShopAlertRow[];
  if (list.length === 0) return { fired: 0, rearmed: 0 };

  const itemNames = Array.from(new Set(list.map((a) => a.item_name)));
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: rows, error: rerr } = await db
    .from("paladium_admin_shop_history")
    .select("item_name, price, price_pb, captured_at")
    .in("item_name", itemNames)
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
    .limit(5000);
  if (rerr) throw new Error(rerr.message);

  const latest = new Map<string, { price: number | null; price_pb: number | null }>();
  for (const r of (rows ?? []) as Array<{
    item_name: string;
    price: number | null;
    price_pb: number | null;
  }>) {
    if (latest.has(r.item_name)) continue;
    latest.set(r.item_name, { price: r.price, price_pb: r.price_pb });
  }

  let fired = 0;
  let rearmed = 0;

  for (const a of list) {
    const snap = latest.get(a.item_name);
    if (!snap) continue;
    const current = a.price_type === "sell" ? snap.price_pb : snap.price;
    if (current === null || current === undefined) continue;

    const matches =
      a.direction === "above" ? current >= a.threshold : current <= a.threshold;

    if (matches && !a.is_triggered) {
      const arrow = a.direction === "above" ? "↑" : "↓";
      const kind = a.price_type === "sell" ? "vente" : "achat";
      const msg =
        `<@${a.user_discord_id}> 🔔 **${a.item_name}** — prix ${kind} ${arrow} ` +
        `**${current.toLocaleString("fr-FR")}** (seuil ${a.threshold.toLocaleString("fr-FR")})`;
      await postAlertMessage(msg);
      await db
        .from("shop_admin_price_alerts")
        .update({ is_triggered: true, last_triggered_at: new Date().toISOString() })
        .eq("id", a.id);
      fired++;
    } else if (!matches && a.is_triggered) {
      await db
        .from("shop_admin_price_alerts")
        .update({ is_triggered: false })
        .eq("id", a.id);
      rearmed++;
    }
  }

  return { fired, rearmed };
}
