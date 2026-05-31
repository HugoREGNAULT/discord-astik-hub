import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

export const listObjectives = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await db
    .from("objectives")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { objectives: data ?? [] };
});

const objectiveInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetValue: z.number().positive().nullish(),
  unit: z.string().max(50).nullish(),
  rewardPoints: z.number().int().min(0).optional(),
});

export const createObjective = createServerFn({ method: "POST" })
  .inputValidator((input) => objectiveInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const { error } = await db.from("objectives").insert({
      title: data.title,
      description: data.description ?? null,
      target_value: data.targetValue ?? null,
      unit: data.unit ?? null,
      reward_points: data.rewardPoints ?? 0,
    });
    if (error) throw new Error(error.message);
    await logAction("objective_create", user.discordId, data);
    return { ok: true };
  });

export const updateObjective = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullish(),
        targetValue: z.number().positive().nullish(),
        unit: z.string().max(50).nullish(),
        rewardPoints: z.number().int().min(0).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const patch: Partial<{
      title: string;
      description: string | null;
      target_value: number | null;
      unit: string | null;
      reward_points: number;
    }> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.targetValue !== undefined) patch.target_value = data.targetValue ?? null;
    if (data.unit !== undefined) patch.unit = data.unit ?? null;
    if (data.rewardPoints !== undefined) patch.reward_points = data.rewardPoints;
    const { error } = await db.from("objectives").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("objective_update", user.discordId, data);
    return { ok: true };
  });

export const toggleObjective = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const { error } = await db
      .from("objectives")
      .update({
        done: data.done,
        done_by_discord_id: data.done ? user.discordId : null,
        done_at: data.done ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("objective_toggle", user.discordId, data);
    return { ok: true };
  });

export const deleteObjective = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    await db.from("objectives").delete().eq("id", data.id);
    await logAction("objective_delete", user.discordId, data);
    return { ok: true };
  });

// ---------- Gauge / contributions ----------

async function recomputeObjective(objectiveId: string) {
  const { data: rows, error } = await db
    .from("objective_contributions")
    .select("amount")
    .eq("objective_id", objectiveId);
  if (error) throw new Error(error.message);
  const sum = (rows ?? []).reduce((acc, r: any) => acc + Number(r.amount ?? 0), 0);

  const { data: obj, error: oErr } = await db
    .from("objectives")
    .select("target_value, done")
    .eq("id", objectiveId)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);

  const patch: Partial<{ current_value: number; done: boolean; done_at: string }> = {
    current_value: sum,
  };
  if (obj?.target_value != null && sum >= Number(obj.target_value) && !obj.done) {
    patch.done = true;
    patch.done_at = new Date().toISOString();
  }
  const { error: uErr } = await db.from("objectives").update(patch).eq("id", objectiveId);
  if (uErr) throw new Error(uErr.message);
  return sum;
}

export const addContribution = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        objectiveId: z.string().uuid(),
        memberDiscordId: z.string().min(1),
        amount: z.number().positive(),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const { data: m } = await db
      .from("members")
      .select("discord_username")
      .eq("discord_id", data.memberDiscordId)
      .maybeSingle();
    const { error } = await db.from("objective_contributions").insert({
      objective_id: data.objectiveId,
      member_discord_id: data.memberDiscordId,
      member_username: m?.discord_username ?? null,
      amount: data.amount,
      note: data.note ?? null,
      created_by_discord_id: user.discordId,
    });
    if (error) throw new Error(error.message);
    await recomputeObjective(data.objectiveId);
    await logAction("objective_contribution_add", user.discordId, data);
    return { ok: true };
  });

export const removeContribution = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), objectiveId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const { error } = await db.from("objective_contributions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recomputeObjective(data.objectiveId);
    await logAction("objective_contribution_remove", user.discordId, data);
    return { ok: true };
  });

export const listObjectiveContributions = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ objectiveId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: rows, error } = await db
      .from("objective_contributions")
      .select("*")
      .eq("objective_id", data.objectiveId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const items = (rows ?? []) as any[];
    const total = items.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
    const withShare = items
      .map((r) => ({
        ...r,
        share_pct: total > 0 ? (Number(r.amount) / total) * 100 : 0,
      }))
      .sort((a, b) => b.share_pct - a.share_pct);
    return { contributions: withShare, total };
  });

export const distributeObjectiveReward = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ objectiveId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");

    const { data: obj, error: oErr } = await db
      .from("objectives")
      .select("id, title, reward_points, rewarded")
      .eq("id", data.objectiveId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!obj) throw new Error("NOT_FOUND");
    if (obj.rewarded) throw new Error("Récompense déjà distribuée");
    const reward = Number(obj.reward_points ?? 0);
    if (reward <= 0) throw new Error("Aucune récompense configurée");

    const { data: rows, error: cErr } = await db
      .from("objective_contributions")
      .select("member_discord_id, amount")
      .eq("objective_id", data.objectiveId);
    if (cErr) throw new Error(cErr.message);
    const contribs = (rows ?? []) as any[];
    if (contribs.length === 0) throw new Error("Aucune contribution");

    // Agréger par membre
    const totals = new Map<string, number>();
    for (const c of contribs) {
      totals.set(
        c.member_discord_id,
        (totals.get(c.member_discord_id) ?? 0) + Number(c.amount ?? 0),
      );
    }
    const grand = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    if (grand <= 0) throw new Error("Total des contributions nul");

    const payouts: { discordId: string; points: number }[] = [];
    for (const [discordId, sum] of totals) {
      const pts = Math.round(reward * (sum / grand));
      if (pts > 0) payouts.push({ discordId, points: pts });
    }
    if (payouts.length === 0) throw new Error("Aucune part à distribuer");

    let total = 0;
    for (const p of payouts) {
      const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
        p_discord_id: p.discordId,
        p_delta: p.points,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const after = (newBalance as number | null) ?? 0;
      const { error: lErr } = await db.from("points_ledger").insert({
        member_discord_id: p.discordId,
        staff_discord_id: user.discordId,
        staff_username: user.username,
        amount: p.points,
        reason: `Objectif: ${obj.title}`,
        total_after: after,
        action_type: "objective",
      });
      if (lErr) throw new Error(lErr.message);
      total += p.points;
    }

    const { error: uErr } = await db
      .from("objectives")
      .update({ rewarded: true })
      .eq("id", data.objectiveId);
    if (uErr) throw new Error(uErr.message);

    await logAction("objective_distribute", user.discordId, {
      id: data.objectiveId,
      total,
      beneficiaries: payouts.length,
    });
    await logToDiscord("site", {
      title: "🎯 Objectif atteint",
      color: COLORS.success,
      description: `**${obj.title}**`,
      fields: [
        { name: "Total", value: `${total} pts`, inline: true },
        { name: "Bénéficiaires", value: String(payouts.length), inline: true },
        { name: "Par", value: user.username, inline: true },
      ],
    });

    return { ok: true, payouts, total };
  });
