/**
 * Server functions pour la blacklist faction.
 *
 * Permission requise : `recruit.access` (recruteurs + staff faction + haut staff).
 * Au moins un identifiant (Discord ID, pseudo MC, ou UUID MC) doit être renseigné.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

const addSchema = z
  .object({
    discordId: z.string().trim().max(32).optional(),
    mcName: z.string().trim().max(32).optional(),
    mcUuid: z.string().trim().max(64).optional(),
    reason: z.string().trim().max(2000).default(""),
  })
  .refine(
    (v) => Boolean(v.discordId || v.mcName || v.mcUuid),
    "Au moins un identifiant requis (Discord ID ou pseudo MC).",
  );

export type BlacklistRow = {
  id: string;
  discord_id: string | null;
  mc_name: string | null;
  mc_uuid: string | null;
  reason: string;
  added_by_discord_id: string;
  added_by_username: string | null;
  created_at: string;
  updated_at: string;
};

export const listBlacklist = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("recruit.access");
  const { data, error } = await db
    .from("blacklist")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { entries: (data ?? []) as BlacklistRow[] };
});

export const addBlacklistEntry = createServerFn({ method: "POST" })
  .inputValidator((input) => addSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("recruit.access");
    const ins = await db
      .from("blacklist")
      .insert({
        discord_id: data.discordId?.trim() || null,
        mc_name: data.mcName?.trim() || null,
        mc_uuid: data.mcUuid?.trim() || null,
        reason: data.reason ?? "",
        added_by_discord_id: staff.discordId,
        added_by_username: staff.username,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    await logAction("blacklist_add", staff.discordId, {
      entry_id: ins.data.id,
      ...data,
    }, "warn");
    return { ok: true, id: ins.data.id };
  });

export const removeBlacklistEntry = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("recruit.access");
    const { error } = await db.from("blacklist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("blacklist_remove", staff.discordId, { entry_id: data.id }, "warn");
    return { ok: true };
  });

const updateSchema = z
  .object({
    id: z.string().uuid(),
    discordId: z.string().trim().max(32).nullable().optional(),
    mcName: z.string().trim().max(32).nullable().optional(),
    mcUuid: z.string().trim().max(64).nullable().optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => Boolean((v.discordId ?? "") || (v.mcName ?? "") || (v.mcUuid ?? "")),
    "Au moins un identifiant requis (Discord ID, pseudo MC ou UUID).",
  );

export const updateBlacklistEntry = createServerFn({ method: "POST" })
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const patch: {
      updated_at: string;
      discord_id?: string | null;
      mc_name?: string | null;
      mc_uuid?: string | null;
      reason?: string;
    } = { updated_at: new Date().toISOString() };
    if (data.discordId !== undefined) patch.discord_id = data.discordId?.trim() || null;
    if (data.mcName !== undefined) patch.mc_name = data.mcName?.trim() || null;
    if (data.mcUuid !== undefined) patch.mc_uuid = data.mcUuid?.trim() || null;
    if (data.reason !== undefined) patch.reason = data.reason;
    const { error } = await db.from("blacklist").update(patch).eq("id", data.id);

    if (error) throw new Error(error.message);
    await logAction("blacklist_update", staff.discordId, { entry_id: data.id, patch }, "warn");
    return { ok: true };
  });

