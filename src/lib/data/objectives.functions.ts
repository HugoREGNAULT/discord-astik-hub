import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";

export const listObjectives = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data, error } = await db
    .from("objectives")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { objectives: data ?? [] };
});

export const createObjective = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const { error } = await db.from("objectives").insert(data);
    if (error) throw new Error(error.message);
    await logAction("objective_create", user.discordId, data);
    return { ok: true };
  });

export const toggleObjective = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    const { error } = await db
      .from("objectives")
      .update({
        done: data.done,
        done_by_discord_id: data.done ? user.discordId : null,
        done_at: data.done ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("objective_toggle", user.discordId, data);
    return { ok: true };
  });

export const deleteObjective = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("objectives.edit");
    await db.from("objectives").delete().eq("id", data.id);
    await logAction("objective_delete", user.discordId, data);
    return { ok: true };
  });
