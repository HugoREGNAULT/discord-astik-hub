/**
 * Boutique interne AstikPoints + trésorerie de faction.
 *
 * Mêmes invariants que donations.functions.ts :
 * - jamais de débit sans validation staff (status pending → approved)
 * - écriture des points via RPC apply_points_delta(p_discord_id, p_delta)
 *   pour éviter les race conditions, members.astik_points sync via trigger.
 * - tout passage critique passe par requirePermission(...).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import {
  requirePermission,
  requireSession,
  requireSelfOrPermission,
  logAction,
} from "@/lib/auth/require.server";
import { canAccess } from "@/lib/auth/permissions";
import { sendDiscordDM } from "@/lib/discord/dm.server";
import { logToDiscord } from "@/lib/discord/log.server";

// ---------------------------------------------------------------------------
// Expiration best-effort des spend_requests pending (équivalent expireOldCarts)
// ---------------------------------------------------------------------------
async function expireSpendRequests() {
  try {
    await db
      .from("spend_requests")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Catalogue — lecture publique (membres) / CRUD staff
// ---------------------------------------------------------------------------
export const listShopRewards = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!canAccess(user, "profile.self")) {
    // profile.self couvre les membres faction / recruteurs / haut staff
    throw new Error("FORBIDDEN");
  }
  const { data, error } = await db
    .from("shop_rewards")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return { rewards: data ?? [] };
});

export const listAllShopRewards = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("shop.manage");
  const { data, error } = await db
    .from("shop_rewards")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return { rewards: data ?? [] };
});

const RewardInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  cost_points: z.number().int().min(1).max(10_000_000),
  category: z.string().max(60).optional().nullable(),
  stock: z.number().int().min(0).nullable().optional(),
  per_member_limit: z.number().int().min(1).nullable().optional(),
  image_url: z.string().url().max(500).nullable().optional(),
  active: z.boolean().optional(),
  display_order: z.number().int().min(0).max(10000).optional(),
});

export const upsertReward = createServerFn({ method: "POST" })
  .inputValidator((input) => RewardInput.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");
    let res;
    if (data.id) {
      const { id, ...patch } = data;
      res = await db.from("shop_rewards").update(patch).eq("id", id).select("*").single();
    } else {
      const { id: _ignored, ...payload } = data;
      res = await db.from("shop_rewards").insert(payload).select("*").single();
    }
    if (res.error) throw new Error(res.error.message);
    await logAction("shop_reward_upsert", user.discordId, { id: res.data.id, name: res.data.name });
    return { reward: res.data };
  });

export const toggleReward = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");
    const { error } = await db
      .from("shop_rewards")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("shop_reward_toggle", user.discordId, data);
    return { ok: true };
  });

export const deleteReward = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");
    const { error } = await db.from("shop_rewards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("shop_reward_delete", user.discordId, data);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Demandes de dépense
// ---------------------------------------------------------------------------
export const createSpendRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        rewardId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();

    // 1. Charger la récompense
    const { data: reward, error: rErr } = await db
      .from("shop_rewards")
      .select("*")
      .eq("id", data.rewardId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!reward) throw new Error("Récompense introuvable");
    if (!reward.active) throw new Error("Récompense indisponible");

    // 2. Stock
    if (reward.stock !== null && reward.stock !== undefined && reward.stock < data.quantity) {
      throw new Error("Stock insuffisant");
    }

    // 3. Limite par membre (compte les demandes non-rejetées/non-expirées)
    if (reward.per_member_limit !== null && reward.per_member_limit !== undefined) {
      const { data: prev, error: pErr } = await db
        .from("spend_requests")
        .select("quantity, status")
        .eq("member_discord_id", user.discordId)
        .eq("reward_id", reward.id)
        .in("status", ["pending", "approved", "fulfilled"]);
      if (pErr) throw new Error(pErr.message);
      const already = (prev ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
      if (already + data.quantity > reward.per_member_limit) {
        throw new Error(`Limite atteinte (${reward.per_member_limit} par membre)`);
      }
    }

    // 4. Solde
    const total = reward.cost_points * data.quantity;
    const { data: member, error: mErr } = await db
      .from("members")
      .select("astik_points")
      .eq("discord_id", user.discordId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Membre introuvable");
    if ((member.astik_points ?? 0) < total) throw new Error("Solde insuffisant");

    // 5. Snapshot de la demande (PAS de débit ici)
    const { data: row, error } = await db
      .from("spend_requests")
      .insert({
        member_discord_id: user.discordId,
        reward_id: reward.id,
        reward_name: reward.name,
        quantity: data.quantity,
        unit_cost: reward.cost_points,
        total_cost: total,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await logAction("shop_spend_request", user.discordId, {
      requestId: row.id,
      rewardId: reward.id,
      total,
    });
    return { request: row };
  });

export const listMySpendRequests = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  await expireSpendRequests();
  const { data, error } = await db
    .from("spend_requests")
    .select("*")
    .eq("member_discord_id", user.discordId)
    .order("requested_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { requests: data ?? [] };
});

export const listPendingSpendRequests = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("shop.manage");
  await expireSpendRequests();
  const { data, error } = await db
    .from("spend_requests")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = Array.from(new Set((data ?? []).map((r) => r.member_discord_id)));
  let members: Record<string, { ig_name: string | null; discord_username: string | null }> = {};
  if (ids.length > 0) {
    const { data: ms } = await db
      .from("members")
      .select("discord_id, ig_name, discord_username")
      .in("discord_id", ids);
    members = Object.fromEntries(
      (ms ?? []).map((m) => [
        m.discord_id,
        { ig_name: m.ig_name, discord_username: m.discord_username },
      ]),
    );
  }
  return { requests: data ?? [], members };
});

export const approveSpendRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");

    // 1. Recharger la demande
    const { data: req, error } = await db
      .from("spend_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Demande introuvable");
    if (req.status !== "pending") throw new Error("Demande non en attente");
    if (new Date(req.expires_at).getTime() < Date.now()) {
      await db.from("spend_requests").update({ status: "expired" }).eq("id", req.id);
      throw new Error("Demande expirée");
    }

    // 2. Re-vérifier le solde
    const { data: member } = await db
      .from("members")
      .select("astik_points")
      .eq("discord_id", req.member_discord_id)
      .maybeSingle();
    if (!member) throw new Error("Membre introuvable");
    if ((member.astik_points ?? 0) < req.total_cost) throw new Error("Solde insuffisant");

    // 3. Débit atomique via RPC
    const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
      p_discord_id: req.member_discord_id,
      p_delta: -req.total_cost,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (newBalance === null || newBalance === undefined)
      throw new Error("Échec du débit (membre introuvable)");
    const after = newBalance as number;

    // 4. Ledger
    const { data: ledger, error: lErr } = await db
      .from("points_ledger")
      .insert({
        member_discord_id: req.member_discord_id,
        staff_discord_id: user.discordId,
        staff_username: user.username,
        amount: -req.total_cost,
        reason: `Boutique: ${req.reward_name} x${req.quantity}`,
        total_after: after,
        action_type: "spend",
      })
      .select("id")
      .single();
    if (lErr) throw new Error(lErr.message);

    // 5. Décrément stock si défini
    if (req.reward_id) {
      const { data: rw } = await db
        .from("shop_rewards")
        .select("stock")
        .eq("id", req.reward_id)
        .maybeSingle();
      if (rw && rw.stock !== null && rw.stock !== undefined) {
        await db
          .from("shop_rewards")
          .update({ stock: Math.max(0, rw.stock - req.quantity) })
          .eq("id", req.reward_id);
      }
    }

    // 6. Marquer approved
    await db
      .from("spend_requests")
      .update({
        status: "approved",
        decided_by_discord_id: user.discordId,
        decided_by_username: user.username,
        decided_at: new Date().toISOString(),
        ledger_id: ledger.id,
      })
      .eq("id", req.id);

    // 7. Notifications best-effort
    void sendDiscordDM(
      req.member_discord_id,
      `✅ Ta demande boutique « **${req.reward_name}** » x${req.quantity} (${req.total_cost} pts) a été approuvée. Nouveau solde: ${after} pts.`,
    ).catch(() => {});
    void logToDiscord("site", {
      title: "Boutique — demande approuvée",
      description: `**${req.reward_name}** x${req.quantity} — ${req.total_cost} pts pour <@${req.member_discord_id}>`,
      color: 0x22c55e,
    }).catch(() => {});

    await logAction("shop_spend_approve", user.discordId, {
      requestId: req.id,
      total: req.total_cost,
      newBalance: after,
    });
    return { ok: true, newBalance: after };
  });

export const rejectSpendRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ requestId: z.string().uuid(), reason: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");
    const { data: req, error } = await db
      .from("spend_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Demande introuvable");
    if (req.status !== "pending") throw new Error("Demande non en attente");

    await db
      .from("spend_requests")
      .update({
        status: "rejected",
        decided_by_discord_id: user.discordId,
        decided_by_username: user.username,
        decided_at: new Date().toISOString(),
        reject_reason: data.reason ?? null,
      })
      .eq("id", req.id);

    void sendDiscordDM(
      req.member_discord_id,
      `❌ Ta demande boutique « **${req.reward_name}** » x${req.quantity} a été refusée.${
        data.reason ? ` Raison: ${data.reason}` : ""
      }`,
    ).catch(() => {});
    await logAction("shop_spend_reject", user.discordId, { requestId: req.id });
    return { ok: true };
  });

export const markFulfilled = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");
    const { data: req, error } = await db
      .from("spend_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Demande introuvable");
    if (req.status !== "approved") throw new Error("Demande non approuvée");

    await db
      .from("spend_requests")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("id", req.id);

    void sendDiscordDM(
      req.member_discord_id,
      `📦 Ta récompense « **${req.reward_name}** » x${req.quantity} a été livrée en jeu.`,
    ).catch(() => {});
    await logAction("shop_spend_fulfilled", user.discordId, { requestId: req.id });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Trésorerie
// ---------------------------------------------------------------------------
export const listTreasury = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("shop.manage");
  const [accountsRes, movementsRes] = await Promise.all([
    db.from("treasury_accounts").select("*").order("created_at", { ascending: true }),
    db
      .from("treasury_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (movementsRes.error) throw new Error(movementsRes.error.message);
  return { accounts: accountsRes.data ?? [], movements: movementsRes.data ?? [] };
});

export const createTreasuryAccount = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(80),
        currency: z.string().min(1).max(10).default("PB"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");
    const { data: row, error } = await db
      .from("treasury_accounts")
      .insert({ name: data.name, currency: data.currency })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logAction("treasury_account_create", user.discordId, { id: row.id });
    return { account: row };
  });

export const addTreasuryMovement = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        accountId: z.string().uuid(),
        delta: z.number().refine((n) => n !== 0, { message: "Delta ne peut pas être 0" }),
        reason: z.string().max(500).optional(),
        source: z.string().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("shop.manage");

    // 1. Recharger compte
    const { data: acc, error: aErr } = await db
      .from("treasury_accounts")
      .select("*")
      .eq("id", data.accountId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!acc) throw new Error("Compte introuvable");

    const balanceAfter = Number(acc.balance) + data.delta;

    // 2. Update solde
    const { error: uErr } = await db
      .from("treasury_accounts")
      .update({ balance: balanceAfter })
      .eq("id", acc.id);
    if (uErr) throw new Error(uErr.message);

    // 3. Insert mouvement
    const { data: mov, error: mErr } = await db
      .from("treasury_movements")
      .insert({
        account_id: acc.id,
        delta: data.delta,
        balance_after: balanceAfter,
        reason: data.reason ?? null,
        source: data.source ?? "manual",
        staff_discord_id: user.discordId,
        staff_username: user.username,
      })
      .select("*")
      .single();
    if (mErr) throw new Error(mErr.message);

    await logAction("treasury_movement", user.discordId, {
      accountId: acc.id,
      delta: data.delta,
      balanceAfter,
    });
    return { movement: mov, balance: balanceAfter };
  });

// Re-export for parity / future use
export { requireSelfOrPermission };
