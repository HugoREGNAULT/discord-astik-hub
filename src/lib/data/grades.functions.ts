import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

// =====================================================================
// Grade thresholds
// =====================================================================

export const listGradeThresholds = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await db
    .from("grade_thresholds")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { thresholds: data ?? [] };
});

const thresholdSchema = z.object({
  id: z.string().uuid().optional(),
  grade_label: z.string().min(1).max(64),
  display_order: z.number().int().min(0).max(1000),
  min_points: z.number().int().min(0).default(0),
  min_days_in_faction: z.number().int().min(0).default(0),
  min_messages_7d: z.number().int().min(0).default(0),
  min_voice_7d_seconds: z.number().int().min(0).default(0),
  min_days_since_rankup: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const upsertThreshold = createServerFn({ method: "POST" })
  .inputValidator((input) => thresholdSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await db.from("grade_thresholds").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _omit, ...row } = data;
      void _omit;
      const { error } = await db.from("grade_thresholds").insert(row);
      if (error) throw new Error(error.message);
    }
    await logAction("grade_threshold_upsert", user.discordId, data);
    return { ok: true };
  });

export const deleteThreshold = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("grade_thresholds").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("grade_threshold_delete", user.discordId, data);
    return { ok: true };
  });

// =====================================================================
// Suggestions de rang-up
// =====================================================================

function daysBetween(from: string | null | undefined, to: Date): number {
  if (!from) return 0;
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export const computeGradeSuggestions = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");
  const now = new Date();
  const [{ data: members, error: mErr }, { data: thresholds, error: tErr }] = await Promise.all([
    db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, current_grade, astik_points, messages_7d, voice_7d_seconds, arrival_date, last_rankup",
      )
      .eq("status", "active"),
    db
      .from("grade_thresholds")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: false }),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (tErr) throw new Error(tErr.message);

  const ordered = thresholds ?? [];
  const orderByLabel = new Map<string, number>(
    ordered.map((t) => [t.grade_label, t.display_order]),
  );

  type Suggestion = {
    discord_id: string;
    name: string;
    current_grade: string | null;
    suggested_grade: string;
    suggested_order: number;
    reasons: string[];
  };

  const suggestions: Suggestion[] = [];

  for (const m of members ?? []) {
    const daysInFaction = daysBetween(m.arrival_date, now);
    const daysSinceRankup = daysBetween(m.last_rankup ?? m.arrival_date, now);

    // ordered desc: first satisfied threshold = highest reachable
    const reached = ordered.find((t) => {
      return (
        (m.astik_points ?? 0) >= t.min_points &&
        daysInFaction >= t.min_days_in_faction &&
        (m.messages_7d ?? 0) >= t.min_messages_7d &&
        (m.voice_7d_seconds ?? 0) >= t.min_voice_7d_seconds &&
        daysSinceRankup >= t.min_days_since_rankup
      );
    });
    if (!reached) continue;

    const currentOrder = m.current_grade ? (orderByLabel.get(m.current_grade) ?? -1) : -1;
    if (reached.display_order <= currentOrder) continue;

    const reasons: string[] = [];
    if (reached.min_points > 0) reasons.push(`${m.astik_points ?? 0} / ${reached.min_points} pts`);
    if (reached.min_days_in_faction > 0)
      reasons.push(`${daysInFaction}j d'ancienneté (≥ ${reached.min_days_in_faction})`);
    if (reached.min_messages_7d > 0)
      reasons.push(`${m.messages_7d ?? 0} msg/7j (≥ ${reached.min_messages_7d})`);
    if (reached.min_voice_7d_seconds > 0)
      reasons.push(
        `${Math.round((m.voice_7d_seconds ?? 0) / 3600)}h vocal/7j (≥ ${Math.round(reached.min_voice_7d_seconds / 3600)}h)`,
      );
    if (reached.min_days_since_rankup > 0)
      reasons.push(`${daysSinceRankup}j depuis dernier up (≥ ${reached.min_days_since_rankup})`);

    suggestions.push({
      discord_id: m.discord_id,
      name: m.ig_name || m.discord_username || m.discord_id,
      current_grade: m.current_grade,
      suggested_grade: reached.grade_label,
      suggested_order: reached.display_order,
      reasons,
    });
  }

  suggestions.sort((a, b) => b.suggested_order - a.suggested_order);
  return { suggestions };
});

export const confirmRankup = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        gradeLabel: z.string().min(1).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await db
      .from("members")
      .update({ current_grade: data.gradeLabel, last_rankup: today })
      .eq("discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);
    await logAction("grade_rankup_confirm", user.discordId, data);
    await logToDiscord("site", {
      title: "Rang-up confirmé",
      description: `<@${data.memberDiscordId}> → **${data.gradeLabel}** (par ${user.username})`,
      color: COLORS.success,
    });
    return {
      ok: true,
      reminder: `Pense à attribuer le rôle Discord « ${data.gradeLabel} » à ce membre.`,
    };
  });

// =====================================================================
// Badges
// =====================================================================

export const listBadges = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await db
    .from("badges")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { badges: data ?? [] };
});

const badgeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Code: lettres minuscules, chiffres, underscore"),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  icon: z.string().max(32).nullish(),
  color: z.string().max(16).nullish(),
  auto_rule: z
    .object({
      metric: z.enum([
        "astik_points",
        "messages_total",
        "messages_7d",
        "voice_total_seconds",
        "voice_7d_seconds",
        "days_in_faction",
      ]),
      gte: z.number(),
    })
    .nullish(),
});

export const upsertBadge = createServerFn({ method: "POST" })
  .inputValidator((input) => badgeSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const row = {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      auto_rule: data.auto_rule ?? null,
    };
    if (data.id) {
      const { error } = await db.from("badges").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("badges").insert(row);
      if (error) throw new Error(error.message);
    }
    await logAction("badge_upsert", user.discordId, { code: data.code });
    return { ok: true };
  });

export const deleteBadge = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("badges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("badge_delete", user.discordId, data);
    return { ok: true };
  });

export const awardBadge = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ memberDiscordId: z.string().min(1), badgeId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("member_badges")
      .upsert(
        {
          member_discord_id: data.memberDiscordId,
          badge_id: data.badgeId,
          awarded_by_discord_id: user.discordId,
        },
        { onConflict: "member_discord_id,badge_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    await logAction("badge_award", user.discordId, data);
    return { ok: true };
  });

export const revokeBadge = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ memberDiscordId: z.string().min(1), badgeId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("member_badges")
      .delete()
      .eq("member_discord_id", data.memberDiscordId)
      .eq("badge_id", data.badgeId);
    if (error) throw new Error(error.message);
    await logAction("badge_revoke", user.discordId, data);
    return { ok: true };
  });

export const getMemberBadges = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ memberDiscordId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSession();
    const { data: rows, error } = await db
      .from("member_badges")
      .select("badge_id, awarded_at, badges:badge_id(id, code, name, description, icon, color)")
      .eq("member_discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);
    return { badges: rows ?? [] };
  });

export const runAutoBadges = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requirePermission("members.edit");
  const { data: badges, error: bErr } = await db
    .from("badges")
    .select("id, code, auto_rule")
    .not("auto_rule", "is", null);
  if (bErr) throw new Error(bErr.message);

  const { data: members, error: mErr } = await db
    .from("members")
    .select(
      "discord_id, astik_points, messages_total, messages_7d, voice_total_seconds, voice_7d_seconds, arrival_date",
    )
    .eq("status", "active");
  if (mErr) throw new Error(mErr.message);

  const now = new Date();
  let awarded = 0;
  for (const b of badges ?? []) {
    const rule = b.auto_rule as { metric: string; gte: number } | null;
    if (!rule) continue;
    const matches = (members ?? []).filter((m) => {
      const v =
        rule.metric === "days_in_faction"
          ? daysBetween(m.arrival_date, now)
          : Number((m as Record<string, unknown>)[rule.metric] ?? 0);
      return v >= rule.gte;
    });
    if (matches.length === 0) continue;
    const rows = matches.map((m) => ({
      member_discord_id: m.discord_id,
      badge_id: b.id,
      awarded_by_discord_id: null as string | null,
    }));
    const { error } = await db
      .from("member_badges")
      .upsert(rows, { onConflict: "member_discord_id,badge_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    awarded += rows.length;
  }
  await logAction("badges_auto_run", user.discordId, { awarded });
  return { ok: true, awarded };
});
