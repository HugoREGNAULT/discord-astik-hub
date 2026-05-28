import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

export const listValues = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("config.manage");
  const { data, error } = await db
    .from("config_values")
    .select("*")
    .order("category", { ascending: true })
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { values: data ?? [] };
});

const valueSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(["item", "action", "other", "money"]),
  name: z.string().min(1).max(120),
  points: z.number().int(),
  active: z.boolean().default(true),
  tier: z.number().int().nullable().optional(),
  display_order: z.number().int().default(0),
});

export const upsertValue = createServerFn({ method: "POST" })
  .inputValidator((input) => valueSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("config.manage");
    if (data.id) {
      const { error } = await db.from("config_values").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("config_values").insert(data);
      if (error) throw new Error(error.message);
    }
    await logAction("value_upsert", user.discordId, data);
    return { ok: true };
  });

export const toggleValueActive = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("config.manage");
    const { error } = await db.from("config_values").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("value_toggle", user.discordId, data);
    return { ok: true };
  });

export const deleteValue = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("config.manage");
    const { error } = await db.from("config_values").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("value_delete", user.discordId, data);
    return { ok: true };
  });
