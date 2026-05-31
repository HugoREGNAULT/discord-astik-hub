/**
 * Salaires hebdomadaires en AstikPoints.
 *
 * Flux : barème par grade → preview (calcul sans écriture) → commit
 * (crédit via apply_points_delta + points_ledger action_type:"salary").
 * Un seul run "committed" par period_start (contrainte unique en BDD).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)");

export type SalaryGrade = {
  id: string;
  grade_label: string;
  weekly_points: number;
  active: boolean;
  min_activity_seconds: number;
};

export type SalaryBreakdownLine = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  grade: string;
  points: number;
  excluded?: { reason: string } | null;
};

// ----------------- Barème -----------------

export const listSalaryGrades = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("points.manage");
  const { data, error } = await db
    .from("salary_grades")
    .select("*")
    .order("weekly_points", { ascending: true });
  if (error) throw new Error(error.message);
  return { grades: (data ?? []) as SalaryGrade[] };
});

export const upsertSalaryGrade = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        gradeLabel: z.string().min(1).max(64),
        weeklyPoints: z.number().int().min(0).max(1_000_000),
        active: z.boolean().optional(),
        minActivitySeconds: z.number().int().min(0).max(7 * 86_400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const payload = {
      grade_label: data.gradeLabel,
      weekly_points: data.weeklyPoints,
      active: data.active ?? true,
      min_activity_seconds: data.minActivitySeconds ?? 0,
    };
    if (data.id) {
      const { error } = await db.from("salary_grades").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("salary_grades")
        .upsert(payload, { onConflict: "grade_label" });
      if (error) throw new Error(error.message);
    }
    await logAction("salary_grade_upsert", user.discordId, payload);
    return { ok: true };
  });

// ----------------- Preview -----------------

async function buildPreview(periodStart: string, periodEnd: string, createdBy: {
  discordId: string;
  username: string | null;
}) {
  const [membersRes, gradesRes] = await Promise.all([
    db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, current_grade, messages_7d, voice_7d_seconds",
      )
      .eq("status", "active"),
    db.from("salary_grades").select("*").eq("active", true),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (gradesRes.error) throw new Error(gradesRes.error.message);

  const factionMembers = filterFactionMembers(membersRes.data ?? []);
  const gradeMap = new Map<string, SalaryGrade>();
  for (const g of (gradesRes.data ?? []) as SalaryGrade[]) {
    gradeMap.set(g.grade_label.toLowerCase(), g);
  }

  const breakdown: SalaryBreakdownLine[] = [];
  let total = 0;
  let recipients = 0;
  for (const m of factionMembers) {
    const gradeKey = (m.current_grade ?? "").toLowerCase();
    const grade = gradeMap.get(gradeKey);
    if (!grade) continue;
    const activity = (m.voice_7d_seconds ?? 0);
    const messages = (m.messages_7d ?? 0);
    if (grade.min_activity_seconds > 0 && activity < grade.min_activity_seconds && messages === 0) {
      breakdown.push({
        discord_id: m.discord_id,
        discord_username: m.discord_username ?? null,
        ig_name: m.ig_name ?? null,
        grade: grade.grade_label,
        points: 0,
        excluded: { reason: "Activité insuffisante" },
      });
      continue;
    }
    breakdown.push({
      discord_id: m.discord_id,
      discord_username: m.discord_username ?? null,
      ig_name: m.ig_name ?? null,
      grade: grade.grade_label,
      points: grade.weekly_points,
    });
    total += grade.weekly_points;
    recipients += 1;
  }

  // Replace any previous preview for this period_start
  await db
    .from("salary_runs")
    .delete()
    .eq("period_start", periodStart)
    .eq("status", "preview");

  const { data: inserted, error: insErr } = await db
    .from("salary_runs")
    .insert({
      period_start: periodStart,
      period_end: periodEnd,
      status: "preview",
      total_points: total,
      recipient_count: recipients,
      breakdown,
      created_by_discord_id: createdBy.discordId,
      created_by_username: createdBy.username,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  return { run: inserted, breakdown, total, recipients };
}

export const previewSalaryRun = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ periodStart: dateSchema, periodEnd: dateSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const res = await buildPreview(data.periodStart, data.periodEnd, {
      discordId: user.discordId,
      username: user.username ?? null,
    });
    await logAction("salary_preview", user.discordId, {
      period: `${data.periodStart}→${data.periodEnd}`,
      total: res.total,
      recipients: res.recipients,
    });
    return res;
  });

// Pour le cron (pas de session utilisateur)
export async function previewSalaryRunForCron(periodStart: string, periodEnd: string) {
  return buildPreview(periodStart, periodEnd, {
    discordId: "system",
    username: "cron",
  });
}

// ----------------- Commit -----------------

export const commitSalaryRun = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");

    const { data: run, error } = await db
      .from("salary_runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error("Run introuvable");
    if (run.status !== "preview") throw new Error("Ce run n'est plus en aperçu");

    const { data: existing } = await db
      .from("salary_runs")
      .select("id")
      .eq("period_start", run.period_start)
      .eq("status", "committed")
      .maybeSingle();
    if (existing) throw new Error("Un versement existe déjà pour cette semaine");

    const breakdown = (run.breakdown as SalaryBreakdownLine[]) ?? [];
    const reason = `Salaire ${run.period_start} → ${run.period_end}`;
    let credited = 0;
    let recipients = 0;

    for (const line of breakdown) {
      if (line.points <= 0 || line.excluded) continue;
      const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
        p_discord_id: line.discord_id,
        p_delta: line.points,
      });
      if (rpcErr) {
        console.error("[salary] apply_points_delta failed", line.discord_id, rpcErr.message);
        continue;
      }
      if (newBalance === null || newBalance === undefined) continue;
      await db.from("points_ledger").insert({
        member_discord_id: line.discord_id,
        staff_discord_id: user.discordId,
        staff_username: user.username,
        amount: line.points,
        reason,
        bonus_pct: 0,
        total_after: newBalance,
        action_type: "salary",
      });
      credited += line.points;
      recipients += 1;
    }

    await db
      .from("salary_runs")
      .update({
        status: "committed",
        committed_at: new Date().toISOString(),
        total_points: credited,
        recipient_count: recipients,
      })
      .eq("id", data.runId);

    await logAction("salary_commit", user.discordId, {
      runId: data.runId,
      total: credited,
      recipients,
    });

    void logToDiscord("site", {
      title: "💰 Salaires versés",
      description: `**${credited.toLocaleString("fr-FR")} pts** à **${recipients}** membres pour la semaine ${run.period_start} → ${run.period_end}`,
      color: COLORS.success,
      footer: { text: `par ${user.username ?? user.discordId}` },
    });

    return { ok: true, total: credited, recipients };
  });

export const cancelSalaryRun = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { data: run } = await db
      .from("salary_runs")
      .select("status")
      .eq("id", data.runId)
      .single();
    if (!run) throw new Error("Run introuvable");
    if (run.status === "committed") throw new Error("Impossible d'annuler un versement validé");
    const { error } = await db
      .from("salary_runs")
      .update({ status: "cancelled" })
      .eq("id", data.runId);
    if (error) throw new Error(error.message);
    await logAction("salary_cancel", user.discordId, { runId: data.runId });
    return { ok: true };
  });

export const listSalaryRuns = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("points.manage");
  const { data, error } = await db
    .from("salary_runs")
    .select("id, period_start, period_end, status, total_points, recipient_count, created_at, committed_at, created_by_username")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { runs: data ?? [] };
});

export const getSalaryRun = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: run, error } = await db
      .from("salary_runs")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error("Run introuvable");
    return { run };
  });
