import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, requireSession, logAction } from "@/lib/auth/require.server";

// ============= LISTING =============
export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("status", { ascending: true })
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (projects ?? []).map((p) => p.id);
  let resources: any[] = [];
  if (ids.length > 0) {
    const { data: rs, error: rErr } = await db
      .from("project_resources")
      .select("*")
      .in("project_id", ids)
      .order("display_order", { ascending: true });
    if (rErr) throw new Error(rErr.message);
    resources = rs ?? [];
  }
  return { projects: projects ?? [], resources };
});

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: project, error } = await db
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Projet introuvable");

    const [{ data: resources }, { data: contributions }] = await Promise.all([
      db
        .from("project_resources")
        .select("*")
        .eq("project_id", data.id)
        .order("display_order", { ascending: true }),
      db
        .from("project_contributions")
        .select("*")
        .eq("project_id", data.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      project,
      resources: resources ?? [],
      contributions: contributions ?? [],
    };
  });

// ============= WRITES (staff faction) =============
const projectSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]).default("planned"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  deadline: z.string().nullable().optional(),
  owner_discord_id: z.string().nullable().optional(),
  owner_username: z.string().nullable().optional(),
});

export const upsertProject = createServerFn({ method: "POST" })
  .inputValidator((i) => projectSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    if (data.id) {
      const patch: any = { ...data };
      if (data.status === "completed") patch.completed_at = new Date().toISOString();
      const { error } = await db.from("projects").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAction("project_update", user.discordId, data as never);
      return { id: data.id };
    } else {
      const { data: row, error } = await db
        .from("projects")
        .insert({
          ...data,
          created_by_discord_id: user.discordId,
          created_by_username: user.username,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logAction("project_create", user.discordId, { id: row.id, title: data.title });
      return { id: row.id as string };
    }
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("project_delete", user.discordId, { id: data.id });
    return { ok: true };
  });

const resourceSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  item_name: z.string().min(1).max(200),
  qty_needed: z.number().min(0),
  qty_collected: z.number().min(0).default(0),
  unit_points: z.number().nullable().optional(),
  display_order: z.number().int().default(0),
});

export const upsertResource = createServerFn({ method: "POST" })
  .inputValidator((i) => resourceSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    if (data.id) {
      const { error } = await db.from("project_resources").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("project_resources").insert(data);
      if (error) throw new Error(error.message);
    }
    await logAction("project_resource_upsert", user.discordId, data as never);
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("project_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("project_resource_delete", user.discordId, data as never);
    return { ok: true };
  });

const contribSchema = z.object({
  project_id: z.string().uuid(),
  resource_id: z.string().uuid().nullable().optional(),
  member_discord_id: z.string().min(1),
  member_username: z.string().nullable().optional(),
  item_name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  points_awarded: z.number().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const addContribution = createServerFn({ method: "POST" })
  .inputValidator((i) => contribSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("project_contributions").insert({
      ...data,
      created_by_discord_id: user.discordId,
    });
    if (error) throw new Error(error.message);

    if (data.resource_id) {
      // Increment qty_collected
      const { data: cur } = await db
        .from("project_resources")
        .select("qty_collected")
        .eq("id", data.resource_id)
        .maybeSingle();
      const cur_q = Number(cur?.qty_collected ?? 0);
      await db
        .from("project_resources")
        .update({ qty_collected: cur_q + data.quantity })
        .eq("id", data.resource_id);
    }

    await logAction("project_contribution_add", user.discordId, data as never);
    return { ok: true };
  });
