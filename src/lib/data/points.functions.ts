import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

async function applyDelta(memberId: string, delta: number, bonusPct: number) {
  const { data: m, error } = await db
    .from("members")
    .select("astik_points")
    .eq("discord_id", memberId)
    .single();
  if (error) throw new Error(error.message);
  const current = m?.astik_points ?? 0;
  const next = Math.max(0, current + delta);
  const realDelta = next - current;
  await db.from("members").update({ astik_points: next }).eq("discord_id", memberId);
  return { realDelta, total: next, bonusPct };
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
    const { data: m } = await db
      .from("members")
      .select("astik_points")
      .eq("discord_id", data.memberDiscordId)
      .single();
    const current = m?.astik_points ?? 0;
    const delta = data.total - current;
    await db
      .from("members")
      .update({ astik_points: data.total })
      .eq("discord_id", data.memberDiscordId);
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: delta,
      reason: data.reason,
      bonus_pct: 0,
      total_after: data.total,
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
    const { requireSession } = await import("@/lib/auth/require.server");
    const { canAccess } = await import("@/lib/auth/permissions");
    const user = await requireSession();
    const isSelf = user.discordId === data.memberDiscordId;
    if (!isSelf && !canAccess(user, "points.manage")) throw new Error("FORBIDDEN");
    const { data: rows, error } = await db
      .from("points_ledger")
      .select("*")
      .eq("member_discord_id", data.memberDiscordId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });

    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });
