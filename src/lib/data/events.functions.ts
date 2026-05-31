/**
 * Événements internes faction (raids/défenses) :
 *  - inscriptions RSVP (yes/maybe/no) sur le modèle des polls
 *  - relevé de présence par le staff
 *  - distribution de butin en AstikPoints (RPC apply_points_delta + points_ledger)
 *
 * Mêmes invariants :
 *  - chaque écriture passe par requirePermission/requireSession + logAction
 *  - distribution idempotente grâce au UNIQUE (event_id, member_discord_id) sur event_loot
 *  - aucune modification de polls.functions.ts ni des autres flux de points
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import {
  requireSession,
  requirePermission,
  logAction,
} from "@/lib/auth/require.server";
import { isFactionMember, canAccess } from "@/lib/auth/permissions";
import { logToDiscord, COLORS } from "@/lib/discord/log.server";

const rsvpSchema = z.enum(["yes", "maybe", "no"]);
const eventTypeSchema = z.enum(["raid", "defense", "training", "meeting", "other"]);

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  type: eventTypeSchema,
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startsAt: z.string().min(1),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------
export const listEvents = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) throw new Error("FORBIDDEN");
  const { data, error } = await db
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { events: data ?? [] };
});

export const getEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    const [evR, sgR, lootR] = await Promise.all([
      db.from("events").select("*").eq("id", data.id).maybeSingle(),
      db
        .from("event_signups")
        .select("*")
        .eq("event_id", data.id)
        .order("created_at", { ascending: true }),
      db.from("event_loot").select("*").eq("event_id", data.id),
    ]);
    if (evR.error) throw new Error(evR.error.message);
    if (!evR.data) throw new Error("NOT_FOUND");

    return {
      event: evR.data,
      signups: sgR.data ?? [],
      loot: lootR.data ?? [],
      myDiscordId: user.discordId,
      canEdit: canAccess(user, "members.edit"),
    };
  });

// ---------------------------------------------------------------------------
// CRUD staff
// ---------------------------------------------------------------------------
export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: ev, error } = await db
      .from("events")
      .insert({
        title: data.title,
        type: data.type,
        description: data.description ?? null,
        location: data.location ?? null,
        starts_at: new Date(data.startsAt).toISOString(),
        created_by_discord_id: user.discordId,
        created_by_username: user.username,
      })
      .select()
      .single();
    if (error || !ev) throw new Error(error?.message ?? "insert failed");

    await logAction("event_create", user.discordId, { id: ev.id, title: ev.title });
    await logToDiscord("site", {
      title: "# Nouvel événement",
      color: COLORS.info,
      description: `**${ev.title}** _(${ev.type})_${ev.location ? `\n📍 ${ev.location}` : ""}\n🗓 ${new Date(ev.starts_at).toLocaleString("fr-FR")}`,
      fields: [{ name: "Créé par", value: user.username, inline: true }],
    });
    return { id: ev.id };
  });

export const updateEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.type !== undefined) patch.type = data.type;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.location !== undefined) patch.location = data.location ?? null;
    if (data.startsAt !== undefined)
      patch.starts_at = new Date(data.startsAt).toISOString();

    const { error } = await db.from("events").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("event_update", user.discordId, { id: data.id });
    return { ok: true };
  });

export const cancelEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: ev, error } = await db
      .from("events")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .select("title")
      .single();
    if (error) throw new Error(error.message);
    await logAction("event_cancel", user.discordId, { id: data.id });
    await logToDiscord("site", {
      title: "❌ Événement annulé",
      color: COLORS.neutral,
      description: `**${ev.title}**`,
      fields: [{ name: "Par", value: user.username, inline: true }],
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// RSVP membre
// ---------------------------------------------------------------------------
export const rsvpEvent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ eventId: z.string().uuid(), choice: rsvpSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    const { data: ev } = await db
      .from("events")
      .select("status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) throw new Error("NOT_FOUND");
    if (ev.status !== "planned") throw new Error("CLOSED");

    const { error } = await db.from("event_signups").upsert(
      {
        event_id: data.eventId,
        member_discord_id: user.discordId,
        member_username: user.username,
        rsvp: data.choice,
      },
      { onConflict: "event_id,member_discord_id" },
    );
    if (error) throw new Error(error.message);
    await logAction("event_rsvp", user.discordId, {
      id: data.eventId,
      choice: data.choice,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Présence (staff)
// ---------------------------------------------------------------------------
export const setAttendance = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        attendances: z
          .array(
            z.object({
              memberDiscordId: z.string().min(1).max(64),
              attended: z.boolean(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");

    const { data: ev } = await db
      .from("events")
      .select("status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) throw new Error("NOT_FOUND");

    for (const a of data.attendances) {
      const { error } = await db
        .from("event_signups")
        .update({ attended: a.attended })
        .eq("event_id", data.eventId)
        .eq("member_discord_id", a.memberDiscordId);
      if (error) throw new Error(error.message);
    }

    if (ev.status !== "done") {
      await db.from("events").update({ status: "locked" }).eq("id", data.eventId);
    }

    await logAction("event_attendance", user.discordId, {
      id: data.eventId,
      n: data.attendances.length,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Compte-rendu
// ---------------------------------------------------------------------------
export const saveReport = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ eventId: z.string().uuid(), report: z.string().max(10_000) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db
      .from("events")
      .update({ report: data.report })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    await logAction("event_report", user.discordId, { id: data.eventId });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Distribution de butin
// ---------------------------------------------------------------------------
const distributeSchema = z.discriminatedUnion("mode", [
  z.object({
    eventId: z.string().uuid(),
    mode: z.literal("flat"),
    amountPerMember: z.number().int().min(1).max(1_000_000),
  }),
  z.object({
    eventId: z.string().uuid(),
    mode: z.literal("shares"),
    shares: z
      .array(
        z.object({
          memberDiscordId: z.string().min(1).max(64),
          points: z.number().int().min(1).max(1_000_000),
        }),
      )
      .min(1)
      .max(200),
  }),
]);

export const distributeLoot = createServerFn({ method: "POST" })
  .inputValidator((input) => distributeSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");

    const { data: ev, error: evErr } = await db
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev) throw new Error("NOT_FOUND");
    if (ev.loot_distributed) throw new Error("Butin déjà distribué");

    // Construire la liste { discordId, points }
    let payouts: { discordId: string; points: number }[] = [];
    if (data.mode === "flat") {
      const { data: sgs, error: sgErr } = await db
        .from("event_signups")
        .select("member_discord_id, attended")
        .eq("event_id", data.eventId)
        .eq("attended", true);
      if (sgErr) throw new Error(sgErr.message);
      payouts = (sgs ?? []).map((s) => ({
        discordId: s.member_discord_id,
        points: data.amountPerMember,
      }));
    } else {
      payouts = data.shares.map((s) => ({
        discordId: s.memberDiscordId,
        points: s.points,
      }));
    }

    if (payouts.length === 0) throw new Error("Aucun bénéficiaire");

    let total = 0;
    for (const p of payouts) {
      // Crédit atomique
      const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
        p_discord_id: p.discordId,
        p_delta: p.points,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const after = (newBalance as number | null) ?? 0;

      const { data: ledger, error: lErr } = await db
        .from("points_ledger")
        .insert({
          member_discord_id: p.discordId,
          staff_discord_id: user.discordId,
          staff_username: user.username,
          amount: p.points,
          reason: `Butin « ${ev.title} »`,
          total_after: after,
          action_type: "event_loot",
        })
        .select("id")
        .single();
      if (lErr) throw new Error(lErr.message);

      const { error: lootErr } = await db.from("event_loot").insert({
        event_id: data.eventId,
        member_discord_id: p.discordId,
        points: p.points,
        ledger_id: ledger.id,
      });
      if (lootErr) throw new Error(lootErr.message);

      total += p.points;
    }

    await db
      .from("events")
      .update({ loot_distributed: true, status: "done" })
      .eq("id", data.eventId);

    await logAction("event_loot", user.discordId, {
      id: data.eventId,
      total,
      beneficiaries: payouts.length,
      mode: data.mode,
    });
    await logToDiscord("site", {
      title: "💰 Butin distribué",
      color: COLORS.info,
      description: `**${ev.title}**`,
      fields: [
        { name: "Total", value: `${total} pts`, inline: true },
        { name: "Bénéficiaires", value: String(payouts.length), inline: true },
        { name: "Par", value: user.username, inline: true },
      ],
    });

    return { total, beneficiaries: payouts.length };
  });
