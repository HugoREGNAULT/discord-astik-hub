import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

const STATUSES = ["todo", "doing", "done", "cancelled"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const listStaffTasks = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        status: z.enum(STATUSES).optional(),
        assignee: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    let q = db
      .from("staff_tasks")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (data.status) q = q.eq("status", data.status);
    if (data.assignee) q = q.eq("assignee_discord_id", data.assignee);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set(
        (rows ?? [])
          .map((r: any) => r.assignee_discord_id)
          .filter((x: any): x is string => !!x),
      ),
    );
    let members: Record<
      string,
      { discord_username: string | null; ig_name: string | null; avatar_url: string | null }
    > = {};
    if (ids.length > 0) {
      const { data: ms } = await db
        .from("members")
        .select("discord_id, discord_username, ig_name, avatar_url")
        .in("discord_id", ids);
      members = Object.fromEntries(
        (ms ?? []).map((m: any) => [
          m.discord_id,
          { discord_username: m.discord_username, ig_name: m.ig_name, avatar_url: m.avatar_url },
        ]),
      );
    }
    return { tasks: rows ?? [], members };
  });

export const createStaffTask = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        assigneeDiscordId: z.string().optional(),
        priority: z.enum(PRIORITIES).optional().default("normal"),
        dueDate: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    let assigneeUsername: string | null = null;
    if (data.assigneeDiscordId) {
      const { data: m } = await db
        .from("members")
        .select("discord_username, ig_name")
        .eq("discord_id", data.assigneeDiscordId)
        .maybeSingle();
      assigneeUsername = (m as any)?.ig_name ?? (m as any)?.discord_username ?? null;
    }
    const { error } = await db.from("staff_tasks").insert({
      title: data.title,
      description: data.description ?? null,
      assignee_discord_id: data.assigneeDiscordId ?? null,
      assignee_username: assigneeUsername,
      priority: data.priority ?? "normal",
      due_date: data.dueDate ?? null,
      created_by_discord_id: user.discordId,
      created_by_username: user.username,
      status: "todo",
    });
    if (error) throw new Error(error.message);
    await logAction("staff_task_create", user.discordId, data);
    return { ok: true };
  });

export const updateStaffTask = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullish(),
        assigneeDiscordId: z.string().nullish(),
        priority: z.enum(PRIORITIES).optional(),
        dueDate: z.string().nullish(),
        displayOrder: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const patch: Partial<{
      title: string;
      description: string | null;
      assignee_discord_id: string | null;
      assignee_username: string | null;
      priority: string;
      due_date: string | null;
      display_order: number;
    }> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.assigneeDiscordId !== undefined) {
      patch.assignee_discord_id = data.assigneeDiscordId ?? null;
      if (data.assigneeDiscordId) {
        const { data: m } = await db
          .from("members")
          .select("discord_username, ig_name")
          .eq("discord_id", data.assigneeDiscordId)
          .maybeSingle();
        patch.assignee_username = (m as any)?.ig_name ?? (m as any)?.discord_username ?? null;
      } else {
        patch.assignee_username = null;
      }
    }
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueDate !== undefined) patch.due_date = data.dueDate ?? null;
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
    const { error } = await db.from("staff_tasks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("staff_task_update", user.discordId, data);
    return { ok: true };
  });

export const setStaffTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { error } = await db
      .from("staff_tasks")
      .update({
        status: data.status,
        done_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("staff_task_status", user.discordId, data);
    return { ok: true };
  });

export const deleteStaffTask = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const { error } = await db.from("staff_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("staff_task_delete", user.discordId, data);
    return { ok: true };
  });
