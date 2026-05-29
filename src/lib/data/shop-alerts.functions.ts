/**
 * Alertes prix — shop admin Paladium + marché HDV.
 * Un membre crée une alerte (source, item, type, direction, seuil).
 * Après chaque snapshot, on évalue les alertes armées et on envoie une
 * mention dans le salon SHOP_ALERTS. Auto-réarmement quand le prix
 * repasse de l'autre côté.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSession } from "@/lib/auth/require.server";
import { DISCORD_API, LOG_CHANNELS } from "@/lib/discord/constants";
import { fetchWithRetry } from "@/lib/http/retry.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export type AlertSource = "shop_admin" | "market";
export type AlertPriceType = "buy" | "sell" | "avg";
export type AlertDirection = "above" | "below";

export interface ShopAlertRow {
  id: string;
  user_discord_id: string;
  user_username: string | null;
  source: AlertSource;
  item_name: string;
  price_type: AlertPriceType;
  direction: AlertDirection;
  threshold: number;
  is_triggered: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

const sourceSchema = z.enum(["shop_admin", "market"]);
const priceTypeSchema = z.enum(["buy", "sell", "avg"]);
const directionSchema = z.enum(["above", "below"]);

/* ============= Lecture ============= */

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

/* ============= Création ============= */

export const createShopAlert = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      source: sourceSchema.default("shop_admin"),
      item_name: z.string().min(1).max(255),
      price_type: priceTypeSchema,
      direction: directionSchema,
      threshold: z.number().positive().max(1_000_000_000),
    }).parse,
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    // Sanity : sur le marché, seul `avg` a du sens ; sur le shop, on
    // refuse `avg`.
    if (data.source === "market" && data.price_type !== "avg") {
      throw new Error("Le marché ne supporte que 'avg' comme type de prix.");
    }
    if (data.source === "shop_admin" && data.price_type === "avg") {
      throw new Error("Le shop admin ne supporte que 'buy' ou 'sell'.");
    }
    const { error } = await db.from("shop_admin_price_alerts").insert({
      user_discord_id: user.discordId,
      user_username: user.username,
      source: data.source,
      item_name: data.item_name,
      price_type: data.price_type,
      direction: data.direction,
      threshold: data.threshold,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============= Édition ============= */

export const updateShopAlert = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      direction: directionSchema.optional(),
      threshold: z.number().positive().max(1_000_000_000).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const patch: Record<string, unknown> = { is_triggered: false };
    if (data.direction) patch.direction = data.direction;
    if (typeof data.threshold === "number") patch.threshold = data.threshold;
    const { error } = await db
      .from("shop_admin_price_alerts")
      .update(patch)
      .eq("id", data.id)
      .eq("user_discord_id", user.discordId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============= Suppression ============= */

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

/* ============= Évaluation ============= */

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

async function evaluateForSource(
  source: AlertSource,
): Promise<{ fired: number; rearmed: number }> {
  const { data: alerts, error: aerr } = await db
    .from("shop_admin_price_alerts")
    .select("*")
    .eq("source", source);
  if (aerr) throw new Error(aerr.message);
  const list = (alerts ?? []) as ShopAlertRow[];
  if (list.length === 0) return { fired: 0, rearmed: 0 };

  const itemNames = Array.from(new Set(list.map((a) => a.item_name)));
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();

  // Récupère la dernière photo des prix pour chaque item, selon la source.
  const latest = new Map<string, { buy: number | null; sell: number | null; avg: number | null }>();

  if (source === "shop_admin") {
    const { data: rows, error: rerr } = await db
      .from("paladium_admin_shop_history")
      .select("item_name, price, price_pb, captured_at")
      .in("item_name", itemNames)
      .gte("captured_at", since)
      .order("captured_at", { ascending: false })
      .limit(5000);
    if (rerr) throw new Error(rerr.message);
    for (const r of (rows ?? []) as Array<{
      item_name: string;
      price: number | null;
      price_pb: number | null;
    }>) {
      if (latest.has(r.item_name)) continue;
      latest.set(r.item_name, { buy: r.price, sell: r.price_pb, avg: null });
    }
  } else {
    const { data: rows, error: rerr } = await db
      .from("paladium_market_price_history")
      .select("item_name, price_average, captured_at")
      .in("item_name", itemNames)
      .gte("captured_at", since)
      .order("captured_at", { ascending: false })
      .limit(5000);
    if (rerr) throw new Error(rerr.message);
    for (const r of (rows ?? []) as Array<{
      item_name: string;
      price_average: number | null;
    }>) {
      if (latest.has(r.item_name)) continue;
      latest.set(r.item_name, {
        buy: null,
        sell: null,
        avg: r.price_average == null ? null : Number(r.price_average),
      });
    }
  }

  let fired = 0;
  let rearmed = 0;

  for (const a of list) {
    const snap = latest.get(a.item_name);
    if (!snap) continue;
    const current = a.price_type === "avg" ? snap.avg : a.price_type === "sell" ? snap.sell : snap.buy;
    if (current === null || current === undefined) continue;

    const matches =
      a.direction === "above" ? current >= a.threshold : current <= a.threshold;

    if (matches && !a.is_triggered) {
      const arrow = a.direction === "above" ? "↑" : "↓";
      const kind =
        a.price_type === "avg" ? "moyen HDV" : a.price_type === "sell" ? "vente" : "achat";
      const label = source === "market" ? "HDV" : "Shop admin";
      const msg =
        `<@${a.user_discord_id}> 🔔 [${label}] **${a.item_name}** — prix ${kind} ${arrow} ` +
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

export async function evaluateShopAlerts(): Promise<{ fired: number; rearmed: number }> {
  return evaluateForSource("shop_admin");
}

export async function evaluateMarketAlerts(): Promise<{ fired: number; rearmed: number }> {
  return evaluateForSource("market");
}
