/**
 * Période d'essai des recrues.
 * - listTrials / getTrialPanel / setMentor / decideTrial : staff (recruit.access)
 * - castTrialVote : staff faction (requireSession + isStaffFaction)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { isStaffFaction } from "@/lib/auth/permissions";
import { sendDiscordDM } from "@/lib/discord/dm.server";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000));
}

export const listTrials = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("recruit.access");
  const { data: members, error } = await db
    .from("members")
    .select(
      "discord_id, discord_username, ig_name, avatar_url, trial_until, mentor_discord_id, arrival_date",
    )
    .eq("status", "trial");
  if (error) throw new Error(error.message);
  const ids = (members ?? []).map((m) => m.discord_id);
  if (ids.length === 0) return { trials: [] };

  const [tasksRes, votesRes] = await Promise.all([
    db
      .from("onboarding_tasks")
      .select("member_discord_id, done")
      .in("member_discord_id", ids),
    db.from("trial_votes").select("member_discord_id, vote").in("member_discord_id", ids),
  ]);
  const tasksByMember = new Map<string, { total: number; done: number }>();
  for (const t of tasksRes.data ?? []) {
    const e = tasksByMember.get(t.member_discord_id) ?? { total: 0, done: 0 };
    e.total++;
    if (t.done) e.done++;
    tasksByMember.set(t.member_discord_id, e);
  }
  const votesByMember = new Map<
    string,
    { keep: number; reject: number; abstain: number }
  >();
  for (const v of votesRes.data ?? []) {
    const e =
      votesByMember.get(v.member_discord_id) ?? { keep: 0, reject: 0, abstain: 0 };
    if (v.vote === "keep") e.keep++;
    else if (v.vote === "reject") e.reject++;
    else if (v.vote === "abstain") e.abstain++;
    votesByMember.set(v.member_discord_id, e);
  }
  return {
    trials: (members ?? []).map((m) => ({
      ...m,
      days_left: daysLeft(m.trial_until),
      tasks: tasksByMember.get(m.discord_id) ?? { total: 0, done: 0 },
      votes: votesByMember.get(m.discord_id) ?? { keep: 0, reject: 0, abstain: 0 },
    })),
  };
});

export const getTrialPanel = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ memberDiscordId: z.string().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("recruit.access");
    const { data: member } = await db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, avatar_url, trial_until, mentor_discord_id, arrival_date, status",
      )
      .eq("discord_id", data.memberDiscordId)
      .maybeSingle();
    if (!member) throw new Error("Membre introuvable");

    const [tasksRes, votesRes] = await Promise.all([
      db
        .from("onboarding_tasks")
        .select("*")
        .eq("member_discord_id", data.memberDiscordId)
        .order("display_order"),
      db
        .from("trial_votes")
        .select("*")
        .eq("member_discord_id", data.memberDiscordId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      member: { ...member, days_left: daysLeft(member.trial_until) },
      tasks: tasksRes.data ?? [],
      votes: votesRes.data ?? [],
    };
  });

export const setMentor = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1).max(32),
        mentorDiscordId: z.string().max(32).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("recruit.access");
    const { error } = await db
      .from("members")
      .update({ mentor_discord_id: data.mentorDiscordId })
      .eq("discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);
    await logAction("trial_set_mentor", user.discordId, { ...data });
    return { ok: true };
  });

export const castTrialVote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1).max(32),
        vote: z.enum(["keep", "reject", "abstain"]),
        comment: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isStaffFaction(user)) throw new Error("FORBIDDEN");
    const { error } = await db
      .from("trial_votes")
      .upsert(
        {
          member_discord_id: data.memberDiscordId,
          voter_discord_id: user.discordId,
          voter_username: user.username,
          vote: data.vote,
          comment: data.comment ?? null,
        },
        { onConflict: "member_discord_id,voter_discord_id" },
      );
    if (error) throw new Error(error.message);
    await logAction("trial_vote", user.discordId, {
      target: data.memberDiscordId,
      vote: data.vote,
    });
    return { ok: true };
  });

export const decideTrial = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1).max(32),
        outcome: z.enum(["keep", "reject"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const staff = await requirePermission("recruit.access");
    const newStatus = data.outcome === "keep" ? "active" : "former";
    const { error } = await db
      .from("members")
      .update({ status: newStatus, trial_until: null })
      .eq("discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);

    const dmMsg =
      data.outcome === "keep"
        ? `🎉 **Bienvenue officielle dans la PunkAstik !**\n\nTa période d'essai est validée par **${staff.username}**. Tu es désormais membre titulaire.`
        : `❌ **Fin de période d'essai**\n\nLe staff (**${staff.username}**) a décidé de ne pas te titulariser. Merci pour ton passage à la PunkAstik.`;
    const dm = await sendDiscordDM(data.memberDiscordId, dmMsg);

    await logAction("trial_decide", staff.discordId, {
      target: data.memberDiscordId,
      outcome: data.outcome,
      dm_ok: dm.ok,
    });
    void logToDiscord("site", {
      title:
        data.outcome === "keep" ? "✅ Titularisation" : "❌ Fin de période d'essai",
      color: data.outcome === "keep" ? COLORS.success : COLORS.danger,
      description: `<@${data.memberDiscordId}> — décidé par **${staff.username}**`,
    });
    return { ok: true };
  });
