import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

/** Marque les paniers expirés. Appelé en best-effort à chaque listing. */
async function expireOldCarts() {
  await db
    .from("donations")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());
}

export const listMyActiveCarts = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requirePermission("donations.manage");
  await expireOldCarts();
  const { data, error } = await db
    .from("donations")
    .select("*, donation_lines(*)")
    .eq("status", "active")
    .eq("staff_discord_id", user.discordId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { carts: data ?? [] };
});

export const listRecentCarts = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(50).optional().default(10) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission("donations.manage");
    await expireOldCarts();
    const { data: carts, error } = await db
      .from("donations")
      .select("*, donation_lines(*)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const memberIds = Array.from(
      new Set((carts ?? []).map((c) => c.member_discord_id).filter((id): id is string => !!id)),
    );
    let members: Record<string, { ig_name: string | null; discord_username: string | null; avatar_url: string | null }> = {};
    if (memberIds.length > 0) {
      const { data: ms } = await db
        .from("members")
        .select("discord_id, ig_name, discord_username, avatar_url")
        .in("discord_id", memberIds);
      members = Object.fromEntries(
        (ms ?? []).map((m) => [
          m.discord_id,
          { ig_name: m.ig_name, discord_username: m.discord_username, avatar_url: m.avatar_url },
        ]),
      );
    }
    return { carts: carts ?? [], members };
  });


export const createCart = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().optional(),
        bonusPct: z.number().min(0).max(500).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("donations.manage");
    const { data: row, error } = await db
      .from("donations")
      .insert({
        staff_discord_id: user.discordId,
        staff_username: user.username,
        member_discord_id: data.memberDiscordId,
        bonus_pct: data.bonusPct,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logAction("cart_create", user.discordId, { cartId: row.id });
    return { cart: row };
  });

async function recomputeCart(cartId: string) {
  const { data: lines } = await db
    .from("donation_lines")
    .select("subtotal")
    .eq("donation_id", cartId);
  const brut = (lines ?? []).reduce((s, l) => s + (l.subtotal ?? 0), 0);
  const { data: cart } = await db.from("donations").select("bonus_pct").eq("id", cartId).single();
  const bonus = cart?.bonus_pct ?? 0;
  const final = Math.round(brut * (1 + bonus / 100));
  await db
    .from("donations")
    .update({ total_brut: brut, total_final: final })
    .eq("id", cartId);
  return { brut, final };
}

export const addCartLine = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        cartId: z.string().uuid(),
        line_type: z.enum(["item", "action", "other", "money"]),
        config_value_id: z.string().uuid().nullable().optional(),
        label: z.string().min(1).max(200),
        unit_points: z.number().int(),
        quantity: z.number().int().min(1).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("donations.manage");
    const subtotal = data.unit_points * data.quantity;
    const { cartId, ...rest } = data;
    const { error } = await db.from("donation_lines").insert({ ...rest, subtotal, donation_id: cartId });
    if (error) throw new Error(error.message);
    const totals = await recomputeCart(cartId);
    await logAction("cart_line_add", user.discordId, { cartId, ...totals });
    return { ok: true, ...totals };
  });

export const removeCartLine = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ lineId: z.string().uuid(), cartId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("donations.manage");
    await db.from("donation_lines").delete().eq("id", data.lineId);
    const totals = await recomputeCart(data.cartId);
    await logAction("cart_line_remove", user.discordId, { ...data });
    return { ok: true, ...totals };
  });

export const validateCart = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ cartId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("donations.manage");
    const { data: cart, error } = await db.from("donations").select("*").eq("id", data.cartId).single();
    if (error || !cart) throw new Error("Panier introuvable");
    if (cart.status !== "active") throw new Error("Panier non actif");
    if (new Date(cart.expires_at).getTime() < Date.now()) throw new Error("Panier expiré");
    if (!cart.member_discord_id) throw new Error("Aucun membre assigné au panier");

    const totals = await recomputeCart(data.cartId);

    // Ajout des points au membre
    const { data: m } = await db
      .from("members")
      .select("astik_points")
      .eq("discord_id", cart.member_discord_id)
      .single();
    const next = (m?.astik_points ?? 0) + totals.final;
    await db.from("members").update({ astik_points: next }).eq("discord_id", cart.member_discord_id);
    await db.from("points_ledger").insert({
      member_discord_id: cart.member_discord_id,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: totals.final,
      reason: `Don validé #${cart.id.slice(0, 8)}`,
      bonus_pct: cart.bonus_pct,
      total_after: next,
      action_type: "donation",
    });
    await db
      .from("donations")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .eq("id", data.cartId);
    await logAction("cart_validate", user.discordId, { cartId: data.cartId, total: totals.final });
    return { ok: true, total: totals.final, newBalance: next };
  });

export const cancelCart = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ cartId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("donations.manage");
    await db
      .from("donations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.cartId);
    await logAction("cart_cancel", user.discordId, data);
    return { ok: true };
  });
