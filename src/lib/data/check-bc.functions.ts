/**
 * Module Check BC — suivi des BC (bases de coffres) repérées par la faction.
 * Chaque membre peut ajouter une BC, modifier son statut et la supprimer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

export const BC_STATUSES = [
  { value: "libre", label: "Libre", tone: "emerald" },
  { value: "surveille", label: "Quelqu'un tourne autour", tone: "amber" },
  { value: "pillage_en_cours", label: "Pillage en cours", tone: "pink" },
  { value: "trouve", label: "Trouvée / pillée", tone: "blurple" },
  { value: "vide", label: "Vide", tone: "zinc" },
  { value: "autre", label: "Autre", tone: "zinc" },
] as const;

const STATUS_VALUES = BC_STATUSES.map((s) => s.value) as [string, ...string[]];

export const listBcChecks = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");
  const { data, error } = await db
    .from("faction_bc_checks")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { checks: data ?? [] };
});

export const createBcCheck = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(200),
        location: z.string().max(500).optional().nullable(),
        status: z.enum(STATUS_VALUES).default("libre"),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { error } = await db.from("faction_bc_checks").insert({
      name: data.name,
      location: data.location ?? null,
      status: data.status,
      notes: data.notes ?? null,
      created_by_discord_id: user.discordId,
      created_by_username: user.username,
      updated_by_discord_id: user.discordId,
      updated_by_username: user.username,
    });
    if (error) throw new Error(error.message);
    await logAction("bc_create", user.discordId, { name: data.name, status: data.status });
    return { ok: true };
  });

export const updateBcCheck = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        location: z.string().max(500).nullable().optional(),
        status: z.enum(STATUS_VALUES).optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const patch: Record<string, unknown> = {
      updated_by_discord_id: user.discordId,
      updated_by_username: user.username,
    };
    if (data.name !== undefined) patch.name = data.name;
    if (data.location !== undefined) patch.location = data.location;
    if (data.status !== undefined) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await db.from("faction_bc_checks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("bc_update", user.discordId, { id: data.id, status: data.status });
    return { ok: true };
  });

export const deleteBcCheck = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { error } = await db.from("faction_bc_checks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("bc_delete", user.discordId, { id: data.id });
    return { ok: true };
  });
