import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { PILLAR_ZSCHEMA, type PointPillar } from "@/lib/data/points-pillars";

async function applyDelta(memberId: string, delta: number, bonusPct: number) {
  // UPDATE atomique via RPC : évite la race condition lecture-puis-écriture.
  // Le trigger SQL `trg_sync_member_points` reste maître à l'insert ledger
  // (idempotent : il réécrit la même valeur via total_after).
  const { data: next, error } = await db.rpc("apply_points_delta", {
    p_discord_id: memberId,
    p_delta: delta,
  });
  if (error) throw new Error(error.message);
  if (next === null || next === undefined) throw new Error("Membre introuvable");
  const total = next as number;
  // Note : si delta négatif et clamp à 0, le ledger enregistre le delta
  // demandé (intention), pas le delta net réellement appliqué — total_after
  // reste exact via le RETURNING de la RPC.
  const realDelta = delta;
  return { realDelta, total, bonusPct };
}

// Plafonds anti-abus côté serveur (un staff junior ne peut pas filer 1M par erreur).
const MAX_POINTS_PER_OP = 100_000;
const MAX_TOTAL_POINTS = 10_000_000;

export const addPoints = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        amount: z.number().int().min(-MAX_POINTS_PER_OP).max(MAX_POINTS_PER_OP),
        reason: z.string().max(500).optional(),
        bonusPct: z.number().min(0).max(500).default(0),
        pillar: PILLAR_ZSCHEMA.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const bonusMultiplier = 1 + (data.bonusPct ?? 0) / 100;
    const finalAmount = Math.round(data.amount * bonusMultiplier);
    const { total } = await applyDelta(data.memberDiscordId, finalAmount, data.bonusPct);
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: finalAmount,
      reason: data.reason,
      bonus_pct: data.bonusPct,
      total_after: total,
      action_type: "add",
      pillar: data.pillar ?? null,
    });
    await logAction("points_add", user.discordId, { ...data, total });
    return { ok: true, total };
  });

export const removePoints = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        amount: z.number().int().positive().max(MAX_POINTS_PER_OP),
        reason: z.string().max(500).optional(),
        pillar: PILLAR_ZSCHEMA.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { realDelta, total } = await applyDelta(data.memberDiscordId, -data.amount, 0);
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: realDelta,
      reason: data.reason,
      bonus_pct: 0,
      total_after: total,
      action_type: "remove",
      pillar: data.pillar ?? null,
    });
    await logAction("points_remove", user.discordId, { ...data, total });
    return { ok: true, total };
  });

export const setPoints = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        total: z.number().int().min(0).max(MAX_TOTAL_POINTS),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    // UPDATE atomique via RPC. Le RETURNING devient total_after du ledger.
    const { data: newTotal, error: rpcErr } = await db.rpc("set_member_points", {
      p_discord_id: data.memberDiscordId,
      p_total: data.total,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (newTotal === null || newTotal === undefined) throw new Error("Membre introuvable");
    const total = newTotal as number;
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: 0, // set absolu : pas de delta significatif
      reason: data.reason,
      bonus_pct: 0,
      total_after: total,
      action_type: "set",
    });
    await logAction("points_set", user.discordId, { ...data });
    return { ok: true, total: data.total };
  });

export const getPointsHistory = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1).max(64),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireSelfOrPermission } = await import("@/lib/auth/require.server");
    await requireSelfOrPermission(data.memberDiscordId, "points.manage");
    const { data: rows, error } = await db
      .from("points_ledger")
      .select("*")
      .eq("member_discord_id", data.memberDiscordId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });

export const getPointsPillarSummary = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ memberDiscordId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: rows, error } = await db
      .from("points_ledger")
      .select("pillar, amount")
      .eq("member_discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);
    const summary = {
      discord_activity: 0,
      ig_investment: 0,
      global_investment: 0,
      uncategorized: 0,
    };
    for (const row of rows ?? []) {
      const key = (row.pillar ?? "uncategorized") as keyof typeof summary;
      summary[key] = (summary[key] ?? 0) + row.amount;
    }
    return { summary };
  });

export const reversePointsTransaction = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        ledgerId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { data: original, error: fetchErr } = await db
      .from("points_ledger")
      .select("*")
      .eq("id", data.ledgerId)
      .single();
    if (fetchErr || !original) throw new Error("Transaction introuvable");
    if (original.action_type === "reversal") throw new Error("Impossible d'annuler une annulation");
    const { count } = await db
      .from("points_ledger")
      .select("id", { count: "exact", head: true })
      .eq("member_discord_id", original.member_discord_id)
      .eq("action_type", "reversal")
      .like("reason", `[rev:${data.ledgerId}]%`);
    if (count && count > 0) throw new Error("Cette transaction a déjà été annulée");
    const reverseAmount = -original.amount;
    const { realDelta, total } = await applyDelta(original.member_discord_id, reverseAmount, 0);
    await db.from("points_ledger").insert({
      member_discord_id: original.member_discord_id,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: realDelta,
      reason: `[rev:${data.ledgerId}] ${data.reason}`,
      bonus_pct: 0,
      total_after: total,
      action_type: "reversal",
      pillar: original.pillar,
    });
    await logAction("points_reversal", user.discordId, {
      ledgerId: data.ledgerId,
      reason: data.reason,
    });
    return { ok: true, total };
  });
