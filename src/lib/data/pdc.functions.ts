import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";

const HEX = /^#[0-9a-fA-F]{6}$/;

// ---------------- Blocks (palette) ----------------

export const listPdcBlocks = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await db
    .from("pdc_blocks")
    .select("*")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return { blocks: data ?? [] };
});

export const createPdcBlock = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        color: z.string().regex(HEX, "Couleur hex invalide (#rrggbb)"),
        kind: z.enum(["block", "liquid"]).default("block"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { data: row, error } = await db
      .from("pdc_blocks")
      .insert({
        name: data.name,
        color: data.color.toLowerCase(),
        kind: data.kind,
        created_by_discord_id: user.discordId,
        created_by_username: user.username,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAction("pdc_block_create", user.discordId, { id: row.id, name: row.name });
    return { block: row };
  });

export const updatePdcBlock = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        color: z.string().regex(HEX).optional(),
        kind: z.enum(["block", "liquid"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.color !== undefined) patch.color = data.color.toLowerCase();
    if (data.kind !== undefined) patch.kind = data.kind;
    const { error } = await db.from("pdc_blocks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("pdc_block_update", user.discordId, { id: data.id });
    return { ok: true };
  });

export const deletePdcBlock = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { error } = await db.from("pdc_blocks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("pdc_block_delete", user.discordId, { id: data.id });
    return { ok: true };
  });

// ---------------- Plans ----------------

const PlanLayersSchema = z.record(z.string(), z.record(z.string(), z.string().uuid()));

export const listPdcPlans = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await db
    .from("pdc_plans")
    .select("id,name,width_chunks,height_chunks,layers_count,created_by_username,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { plans: data ?? [] };
});

export const getPdcPlan = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: plan, error } = await db
      .from("pdc_plans")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { plan };
  });

export const createPdcPlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        width_chunks: z.number().int().min(1).max(50),
        height_chunks: z.number().int().min(1).max(50),
        layers_count: z.number().int().min(1).max(256).default(1),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { data: row, error } = await db
      .from("pdc_plans")
      .insert({
        name: data.name,
        width_chunks: data.width_chunks,
        height_chunks: data.height_chunks,
        layers_count: data.layers_count,
        notes: data.notes ?? null,
        layers: {},
        created_by_discord_id: user.discordId,
        created_by_username: user.username,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAction("pdc_plan_create", user.discordId, { id: row.id, name: row.name });
    return { plan: row };
  });

export const savePdcPlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        layers_count: z.number().int().min(1).max(256).optional(),
        notes: z.string().max(2000).optional(),
        layers: PlanLayersSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.layers_count !== undefined) patch.layers_count = data.layers_count;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.layers !== undefined) patch.layers = data.layers;
    const { error } = await db.from("pdc_plans").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("pdc_plan_save", user.discordId, { id: data.id });
    return { ok: true };
  });

export const deletePdcPlan = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { error } = await db.from("pdc_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("pdc_plan_delete", user.discordId, { id: data.id });
    return { ok: true };
  });
