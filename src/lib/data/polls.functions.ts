/**
 * Sondages de planification (style Rallly).
 * Tout membre faction authentifié peut voter.
 * Création / clôture / suppression réservées au staff faction (perm `members.edit`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { isFactionMember, canAccess, listPermissions } from "@/lib/auth/permissions";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

const choiceSchema = z.enum(["yes", "maybe", "no"]);

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  options: z
    .array(
      z.object({
        startsAt: z.string().min(1),
        durationMinutes: z
          .number()
          .int()
          .min(15)
          .max(24 * 60)
          .default(60),
      }),
    )
    .min(2)
    .max(20),
});

export const listPolls = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) throw new Error("FORBIDDEN");
  const { data, error } = await db
    .from("polls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return { polls: data ?? [] };
});

export const getPoll = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    const allowed = isFactionMember(user);
    const canEdit = canAccess(user, "members.edit");
    // Journal d'accès — diagnostic des redirections inattendues sur /polls/:id
    console.log(
      JSON.stringify({
        tag: "poll_access",
        route: "/polls/:id",
        pollId: data.id,
        userId: user.discordId,
        username: user.username,
        roleIds: user.roleIds,
        permissions: listPermissions(user),
        isFactionMember: allowed,
        canManage: canEdit,
        at: new Date().toISOString(),
      }),
    );
    if (!allowed) {
      console.warn(
        JSON.stringify({
          tag: "poll_access_denied",
          pollId: data.id,
          userId: user.discordId,
          roleIds: user.roleIds,
        }),
      );
      throw new Error("FORBIDDEN");
    }

    const [pollR, optsR, votesR] = await Promise.all([
      db.from("polls").select("*").eq("id", data.id).maybeSingle(),
      db
        .from("poll_options")
        .select("*")
        .eq("poll_id", data.id)
        .order("starts_at", { ascending: true }),
      db.from("poll_votes").select("*").eq("poll_id", data.id),
    ]);
    if (pollR.error) throw new Error(pollR.error.message);
    if (!pollR.data) {
      console.warn(
        JSON.stringify({
          tag: "poll_not_found",
          pollId: data.id,
          userId: user.discordId,
        }),
      );
      throw new Error("NOT_FOUND");
    }

    return {
      poll: pollR.data,
      options: optsR.data ?? [],
      votes: votesR.data ?? [],
      myDiscordId: user.discordId,
    };
  });

export const createPoll = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: poll, error } = await db
      .from("polls")
      .insert({
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        created_by_discord_id: user.discordId,
        created_by_username: user.username,
      })
      .select()
      .single();
    if (error || !poll) throw new Error(error?.message ?? "insert failed");

    const optRows = data.options.map((o, i) => ({
      poll_id: poll.id,
      starts_at: new Date(o.startsAt).toISOString(),
      duration_minutes: o.durationMinutes,
      display_order: i,
    }));
    const { error: oe } = await db.from("poll_options").insert(optRows);
    if (oe) throw new Error(oe.message);

    await logAction("poll_create", user.discordId, { id: poll.id, title: poll.title });
    await logToDiscord("site", {
      title: "📅 Nouveau sondage",
      color: COLORS.info,
      description: `**${poll.title}**${poll.location ? `\n📍 ${poll.location}` : ""}`,
      fields: [
        { name: "Créé par", value: user.username, inline: true },
        { name: "Créneaux", value: String(optRows.length), inline: true },
      ],
    });
    return { id: poll.id };
  });

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        pollId: z.string().uuid(),
        votes: z
          .array(z.object({ optionId: z.string().uuid(), choice: choiceSchema }))
          .min(1)
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    const { data: poll } = await db
      .from("polls")
      .select("status")
      .eq("id", data.pollId)
      .maybeSingle();
    if (!poll) throw new Error("NOT_FOUND");
    if (poll.status !== "open") throw new Error("CLOSED");

    const rows = data.votes.map((v) => ({
      poll_id: data.pollId,
      option_id: v.optionId,
      voter_discord_id: user.discordId,
      voter_username: user.username,
      choice: v.choice,
    }));
    const { error } = await db
      .from("poll_votes")
      .upsert(rows, { onConflict: "option_id,voter_discord_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closePoll = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        pollId: z.string().uuid(),
        winningOptionId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: poll, error } = await db
      .from("polls")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        winning_option_id: data.winningOptionId ?? null,
      })
      .eq("id", data.pollId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    let winInfo = "";
    if (data.winningOptionId) {
      const { data: opt } = await db
        .from("poll_options")
        .select("starts_at")
        .eq("id", data.winningOptionId)
        .maybeSingle();
      if (opt) winInfo = `\n🏆 ${new Date(opt.starts_at).toLocaleString("fr-FR")}`;
    }

    await logAction("poll_close", user.discordId, { id: data.pollId });
    await logToDiscord("site", {
      title: "🔒 Sondage clôturé",
      color: COLORS.neutral,
      description: `**${poll.title}**${winInfo}`,
      fields: [{ name: "Clôturé par", value: user.username, inline: true }],
    });
    return { ok: true };
  });

export const deletePoll = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pollId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("polls").delete().eq("id", data.pollId);
    if (error) throw new Error(error.message);
    await logAction("poll_delete", user.discordId, { id: data.pollId });
    return { ok: true };
  });

export const reopenPoll = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ pollId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("polls")
      .update({ status: "open", closed_at: null, winning_option_id: null })
      .eq("id", data.pollId);
    if (error) throw new Error(error.message);
    await logAction("poll_reopen", user.discordId, { id: data.pollId });
    return { ok: true };
  });

const importSchema = z.object({
  pollId: z.string().uuid(),
  voters: z
    .array(
      z.object({
        discordId: z.string().min(1).max(64),
        username: z.string().trim().min(1).max(120),
        choices: z
          .array(
            z.object({
              optionId: z.string().uuid(),
              choice: choiceSchema,
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Import en lot des votes pour un sondage (typiquement depuis un CSV Framadate).
 * Staff uniquement. Upsert sur (option_id, voter_discord_id).
 */
export const importPollVotes = createServerFn({ method: "POST" })
  .inputValidator((input) => importSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");

    const { data: poll } = await db
      .from("polls")
      .select("status,title")
      .eq("id", data.pollId)
      .maybeSingle();
    if (!poll) throw new Error("NOT_FOUND");
    if (poll.status !== "open") throw new Error("CLOSED");

    const rows = data.voters.flatMap((v) =>
      v.choices.map((c) => ({
        poll_id: data.pollId,
        option_id: c.optionId,
        voter_discord_id: v.discordId,
        voter_username: v.username,
        choice: c.choice,
      })),
    );

    const { error } = await db
      .from("poll_votes")
      .upsert(rows, { onConflict: "option_id,voter_discord_id" });
    if (error) throw new Error(error.message);

    await logAction("poll_import_votes", user.discordId, {
      id: data.pollId,
      voters: data.voters.length,
      rows: rows.length,
    });
    await logToDiscord("site", {
      title: "📥 Import de votes",
      color: COLORS.info,
      description: `**${poll.title}**`,
      fields: [
        { name: "Par", value: user.username, inline: true },
        { name: "Membres", value: String(data.voters.length), inline: true },
        { name: "Votes", value: String(rows.length), inline: true },
      ],
    });

    return { ok: true, voters: data.voters.length, votes: rows.length };
  });
