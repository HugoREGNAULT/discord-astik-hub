/**
 * Logique métier de validation des dons partagée entre la server function
 * `validateCart` (UI) et le hook bot `/api/public/bot/query/don-valider`.
 */
import { db } from "@/lib/db.server";
import { logAction } from "@/lib/auth/require.server";

const MAX_TOTAL_POINTS = 10_000_000;

async function recomputeCart(cartId: string) {
  const { data: lines } = await db
    .from("donation_lines")
    .select("subtotal")
    .eq("donation_id", cartId);
  const brut = (lines ?? []).reduce((s, l) => s + (l.subtotal ?? 0), 0);
  const { data: cart } = await db.from("donations").select("bonus_pct").eq("id", cartId).single();
  const bonus = cart?.bonus_pct ?? 0;
  const final = Math.round(brut * (1 + bonus / 100));
  await db.from("donations").update({ total_brut: brut, total_final: final }).eq("id", cartId);
  return { brut, final };
}

export interface ValidateCartActor {
  discordId: string;
  username: string;
}

export async function validateDonationCart(
  cartId: string,
  actor: ValidateCartActor,
  source: "ui" | "bot",
) {
  const { data: cart, error } = await db
    .from("donations")
    .select("*")
    .eq("id", cartId)
    .single();
  if (error || !cart) throw new Error("Panier introuvable");
  if (cart.status !== "active") throw new Error("Panier non actif");
  if (new Date(cart.expires_at).getTime() < Date.now()) throw new Error("Panier expiré");
  if (!cart.member_discord_id) throw new Error("Aucun membre assigné au panier");

  const totals = await recomputeCart(cartId);
  if (Math.abs(totals.final) > MAX_TOTAL_POINTS) {
    throw new Error("Total du panier excède la limite autorisée");
  }

  const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
    p_discord_id: cart.member_discord_id,
    p_delta: totals.final,
  });
  if (rpcErr) throw new Error(rpcErr.message);
  if (newBalance === null || newBalance === undefined) throw new Error("Membre introuvable");
  const next = newBalance as number;

  await db.from("points_ledger").insert({
    member_discord_id: cart.member_discord_id,
    staff_discord_id: actor.discordId,
    staff_username: actor.username,
    amount: totals.final,
    reason: `Don validé #${cart.id.slice(0, 8)}${source === "bot" ? " (bot)" : ""}`,
    bonus_pct: cart.bonus_pct,
    total_after: next,
    action_type: "donation",
  });
  await db
    .from("donations")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .eq("id", cartId);
  await logAction(source === "bot" ? "donation_validate_via_bot" : "cart_validate", actor.discordId, {
    cartId,
    total: totals.final,
    member: cart.member_discord_id,
  });
  return { ok: true, total: totals.final, newBalance: next, memberDiscordId: cart.member_discord_id };
}
