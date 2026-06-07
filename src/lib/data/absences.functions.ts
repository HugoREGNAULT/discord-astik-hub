/**
 * Absences déclarées par les membres (vacances, IRL, maladie, autre).
 * Tout membre faction authentifié voit le calendrier complet.
 * Chaque membre gère ses propres absences ; le staff (perm `members.edit`)
 * peut éditer/supprimer celles de n'importe qui.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { canAccess, isFactionMember } from "@/lib/auth/permissions";

const typeSchema = z.enum(["vacation", "irl", "illness", "other"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)");

const createSchema = z
  .object({
    memberDiscordId: z.string().min(1).max(64).optional(),
    type: typeSchema,
    reason: z.string().trim().max(500).optional().nullable(),
    startsOn: dateSchema,
    endsOn: dateSchema,
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "La date de fin doit être après le début" });

const updateSchema = z
  .object({
    id: z.string().uuid(),
    type: typeSchema,
    reason: z.string().trim().max(500).optional().nullable(),
    startsOn: dateSchema,
    endsOn: dateSchema,
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "La date de fin doit être après le début" });

/**
 * Lève une erreur si une autre absence du membre chevauche la plage [startsOn ; endsOn].
 * Deux plages [a1,a2] et [b1,b2] se chevauchent ssi a1 <= b2 && b1 <= a2.
 * Si `excludeId` est fourni (mode update), on ignore cette ligne.
 */
async function assertNoOverlap(
  memberDiscordId: string,
  startsOn: string,
  endsOn: string,
  excludeId?: string,
): Promise<void> {
  let q = db
    .from("absences")
    .select("id, starts_on, ends_on")
    .eq("member_discord_id", memberDiscordId)
    .lte("starts_on", endsOn)
    .gte("ends_on", startsOn);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.limit(1);
  if (error) throw new Error(error.message);
  if (data && data.length > 0) {
    throw new Error("Tu as déjà une absence qui chevauche cette période.");
  }
}

export const listAbsences = createServerFn({ method: "GET" })
  .inputValidator((input?: { from?: string; to?: string }) =>
    z
      .object({
        from: dateSchema.optional(),
        to: dateSchema.optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    let q = db.from("absences").select("*").order("starts_on", { ascending: true }).limit(500);
    if (data.from) q = q.gte("ends_on", data.from);
    if (data.to) q = q.lte("starts_on", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Enrich with member names + Minecraft UUID (pour avatar tête MC) + Discord avatar
    const ids = Array.from(new Set((rows ?? []).map((r) => r.member_discord_id)));
    const names: Record<string, { name: string; avatar?: string | null; mc_uuid?: string | null }> =
      {};
    if (ids.length) {
      const { data: members } = await db
        .from("members")
        .select("discord_id, ig_name, discord_username, avatar_url, mc_uuid")
        .in("discord_id", ids);
      for (const m of members ?? []) {
        names[m.discord_id] = {
          name: m.ig_name || m.discord_username || m.discord_id,
          avatar: m.avatar_url,
          mc_uuid: m.mc_uuid,
        };
      }
    }

    const absences = (rows ?? []).map((r) => ({
      ...r,
      member_name: names[r.member_discord_id]?.name ?? r.member_discord_id,
      member_avatar: names[r.member_discord_id]?.avatar ?? null,
      member_mc_uuid: names[r.member_discord_id]?.mc_uuid ?? null,
    }));

    return { absences, myDiscordId: user.discordId };
  });

export const createAbsence = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    // Members can only create their own; staff can target any member
    let targetId = user.discordId;
    if (data.memberDiscordId && data.memberDiscordId !== user.discordId) {
      if (!canAccess(user, "members.edit")) throw new Error("FORBIDDEN");
      targetId = data.memberDiscordId;
    }

    // Anti-chevauchement (silencieux si déjà gérer côté UI, sinon erreur claire).
    await assertNoOverlap(targetId, data.startsOn, data.endsOn);

    const { data: row, error } = await db
      .from("absences")
      .insert({
        member_discord_id: targetId,
        created_by_discord_id: user.discordId,
        created_by_username: user.username,
        type: data.type,
        reason: data.reason?.trim() || null,
        starts_on: data.startsOn,
        ends_on: data.endsOn,
      })
      .select()
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    await logAction("absence_create", user.discordId, {
      id: row.id,
      target: targetId,
      from: data.startsOn,
      to: data.endsOn,
    });
    return { id: row.id };
  });

export const updateAbsence = createServerFn({ method: "POST" })
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    const { data: existing } = await db
      .from("absences")
      .select("member_discord_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("NOT_FOUND");
    const isOwner = existing.member_discord_id === user.discordId;
    if (!isOwner && !canAccess(user, "members.edit")) throw new Error("FORBIDDEN");

    // Anti-chevauchement avec d'autres absences du membre (on s'exclut soi-même).
    await assertNoOverlap(existing.member_discord_id, data.startsOn, data.endsOn, data.id);

    const { error } = await db
      .from("absences")
      .update({
        type: data.type,
        reason: data.reason?.trim() || null,
        starts_on: data.startsOn,
        ends_on: data.endsOn,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAction("absence_update", user.discordId, { id: data.id });
    return { ok: true };
  });

/**
 * Raccourci : clore une absence active aujourd'hui (ramène ends_on à today).
 * Ownership-checked (membre OU staff members.edit).
 */
export const endAbsenceToday = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    const { data: existing } = await db
      .from("absences")
      .select("member_discord_id, starts_on, ends_on")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("NOT_FOUND");
    const isOwner = existing.member_discord_id === user.discordId;
    if (!isOwner && !canAccess(user, "members.edit")) throw new Error("FORBIDDEN");

    const today = new Date().toISOString().slice(0, 10);
    if (today < existing.starts_on) throw new Error("Cette absence n'a pas encore commencé.");
    if (today > existing.ends_on) throw new Error("Cette absence est déjà terminée.");

    const { error } = await db.from("absences").update({ ends_on: today }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAction("absence_end_today", user.discordId, { id: data.id });
    return { ok: true };
  });

export const deleteAbsence = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");

    const { data: existing } = await db
      .from("absences")
      .select("member_discord_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("NOT_FOUND");
    const isOwner = existing.member_discord_id === user.discordId;
    if (!isOwner && !canAccess(user, "members.edit")) {
      await requirePermission("members.edit"); // throws standard error
    }

    const { error } = await db.from("absences").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("absence_delete", user.discordId, { id: data.id });
    return { ok: true };
  });
