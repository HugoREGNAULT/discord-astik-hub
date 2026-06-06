/**
 * Quêtes hebdomadaires : progression du membre (sur données existantes) + réclamation
 * de récompense (crédit AstikPoints), et gestion des templates côté staff (quests.manage).
 *
 * La période de la semaine est créée à la volée (ensureCurrentPeriod) — pas de dépendance
 * stricte à pg_cron. Un cron optionnel est fourni dans la migration en filet.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";

const QUEST_TYPES = ["messages", "voice_hours", "donation_points", "points_earned"] as const;

function weekStartIso(): string {
  const x = new Date();
  const dow = (x.getUTCDay() + 6) % 7; // 0 = lundi
  x.setUTCDate(x.getUTCDate() - dow);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Crée (si absente) et renvoie la période de quêtes de la semaine courante. */
async function ensureCurrentPeriod(): Promise<{ id: string; starts_on: string; ends_on: string }> {
  const starts_on = weekStartIso();
  const ends_on = addDaysIso(starts_on, 7);
  await db
    .from("quest_periods")
    .upsert({ starts_on, ends_on }, { onConflict: "starts_on", ignoreDuplicates: true });
  const { data, error } = await db
    .from("quest_periods")
    .select("id, starts_on, ends_on")
    .eq("starts_on", starts_on)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

interface Progress {
  messages: number;
  voice_hours: number;
  donation_points: number;
  points_earned: number;
}

/** Valeurs courantes du membre pour chaque type de quête, depuis le début de la période. */
async function computeProgress(discordId: string, periodStart: string): Promise<Progress> {
  const [memberRes, ledgerRes] = await Promise.all([
    db
      .from("members")
      .select("messages_7d, voice_7d_seconds")
      .eq("discord_id", discordId)
      .maybeSingle(),
    db
      .from("points_ledger")
      .select("action_type, amount")
      .eq("member_discord_id", discordId)
      .gte("created_at", `${periodStart}T00:00:00Z`),
  ]);
  let donationPoints = 0;
  let pointsEarned = 0;
  for (const r of ledgerRes.data ?? []) {
    const amt = r.amount ?? 0;
    if (r.action_type === "donation") donationPoints += amt;
    if (amt > 0 && r.action_type !== "quest_reward") pointsEarned += amt;
  }
  return {
    messages: memberRes.data?.messages_7d ?? 0,
    voice_hours: Math.floor((memberRes.data?.voice_7d_seconds ?? 0) / 3600),
    donation_points: donationPoints,
    points_earned: pointsEarned,
  };
}

function currentForType(p: Progress, type: string): number {
  switch (type) {
    case "messages":
      return p.messages;
    case "voice_hours":
      return p.voice_hours;
    case "donation_points":
      return p.donation_points;
    case "points_earned":
      return p.points_earned;
    default:
      return 0;
  }
}

/** Quêtes de la semaine du membre connecté : progression + état de réclamation. */
export const getMyQuests = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const period = await ensureCurrentPeriod();
  const [tplRes, claimsRes, progress] = await Promise.all([
    db
      .from("quest_templates")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true }),
    db
      .from("member_quest_claims")
      .select("template_id")
      .eq("member_discord_id", user.discordId)
      .eq("period_id", period.id),
    computeProgress(user.discordId, period.starts_on),
  ]);
  if (tplRes.error) throw new Error(tplRes.error.message);

  const claimed = new Set((claimsRes.data ?? []).map((c) => c.template_id));
  const quests = (tplRes.data ?? []).map((t) => {
    const current = currentForType(progress, t.quest_type);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      quest_type: t.quest_type,
      target: t.target_value,
      reward: t.reward_points,
      current,
      completed: current >= t.target_value,
      claimed: claimed.has(t.id),
    };
  });
  return { period, quests };
});

/** Réclame la récompense d'une quête complétée (anti-triche + idempotent via UNIQUE). */
export const claimQuestReward = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ templateId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const period = await ensureCurrentPeriod();

    const tplRes = await db
      .from("quest_templates")
      .select("*")
      .eq("id", data.templateId)
      .eq("active", true)
      .maybeSingle();
    if (tplRes.error) throw new Error(tplRes.error.message);
    const tpl = tplRes.data;
    if (!tpl) throw new Error("Quête introuvable");

    // Vérifier la complétion CÔTÉ SERVEUR (on ne fait pas confiance au client).
    const progress = await computeProgress(user.discordId, period.starts_on);
    if (currentForType(progress, tpl.quest_type) < tpl.target_value) {
      throw new Error("Quête pas encore terminée");
    }

    // La contrainte UNIQUE(period, template, member) empêche la double récompense.
    const claimIns = await db.from("member_quest_claims").insert({
      period_id: period.id,
      template_id: tpl.id,
      member_discord_id: user.discordId,
      reward_points: tpl.reward_points,
    });
    if (claimIns.error) throw new Error("Récompense déjà réclamée cette semaine");

    // Créditer les AstikPoints (apply_points_delta + ligne de ledger, comme le reste du code).
    if (tpl.reward_points > 0) {
      const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
        p_discord_id: user.discordId,
        p_delta: tpl.reward_points,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      await db.from("points_ledger").insert({
        member_discord_id: user.discordId,
        staff_discord_id: user.discordId,
        staff_username: user.username,
        amount: tpl.reward_points,
        reason: `Quête : ${tpl.title}`,
        total_after: (newBalance as number) ?? 0,
        action_type: "quest_reward",
      });
    }

    await logAction("quest_claim", user.discordId, {
      templateId: tpl.id,
      reward: tpl.reward_points,
    });
    return { ok: true, reward: tpl.reward_points };
  });

/* ---------- Staff : gestion des templates de quêtes (quests.manage) ---------- */

export const listQuestTemplates = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("quests.manage");
  const { data, error } = await db
    .from("quest_templates")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { templates: data ?? [] };
});

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  quest_type: z.enum(QUEST_TYPES),
  target_value: z.number().int().min(1).max(1_000_000),
  reward_points: z.number().int().min(0).max(1_000_000),
  active: z.boolean().optional().default(true),
  display_order: z.number().int().min(0).max(1000).optional().default(0),
});

export const upsertQuestTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => templateSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("quests.manage");
    const row = {
      title: data.title,
      description: data.description?.trim() || null,
      quest_type: data.quest_type,
      target_value: data.target_value,
      reward_points: data.reward_points,
      active: data.active,
      display_order: data.display_order,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const upd = await db.from("quest_templates").update(row).eq("id", data.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await db.from("quest_templates").insert(row);
      if (ins.error) throw new Error(ins.error.message);
    }
    await logAction("quest_template_upsert", user.discordId, {
      id: data.id ?? null,
      title: data.title,
    });
    return { ok: true };
  });

export const deleteQuestTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("quests.manage");
    const del = await db.from("quest_templates").delete().eq("id", data.id);
    if (del.error) throw new Error(del.error.message);
    await logAction("quest_template_delete", user.discordId, { id: data.id });
    return { ok: true };
  });
