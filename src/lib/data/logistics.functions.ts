/**
 * Logistique : coffres communs, stocks d'items et demandes de matériel.
 * - Lecture : tout membre faction authentifié.
 * - CRUD coffres / stock : permission `members.edit`.
 * - Demandes : un membre crée la sienne, le staff (`members.edit`) la décide.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { isFactionMember } from "@/lib/auth/permissions";

// ---------- Coffres ----------

export const listChests = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) throw new Error("FORBIDDEN");
  const { data, error } = await db
    .from("storage_chests")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return { chests: data ?? [] };
});

const chestSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const upsertChest = createServerFn({ method: "POST" })
  .inputValidator((input) => chestSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    if (data.id) {
      const { error } = await db
        .from("storage_chests")
        .update({ name: data.name, location: data.location ?? null, description: data.description ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("storage_chests").insert({
        name: data.name,
        location: data.location ?? null,
        description: data.description ?? null,
        created_by_discord_id: user.discordId,
      });
      if (error) throw new Error(error.message);
    }
    await logAction("logistics_chest_upsert", user.discordId, data);
    return { ok: true };
  });

export const deleteChest = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("storage_chests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("logistics_chest_delete", user.discordId, data);
    return { ok: true };
  });

// ---------- Stock ----------

export const listStock = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) throw new Error("FORBIDDEN");
  const { data, error } = await db
    .from("stock_items")
    .select("*")
    .order("item_name", { ascending: true });
  if (error) throw new Error(error.message);
  const { data: chests } = await db.from("storage_chests").select("id, name");
  const chestMap = new Map((chests ?? []).map((c) => [c.id, c.name]));
  const items = (data ?? []).map((it) => ({
    ...it,
    chest_name: it.chest_id ? chestMap.get(it.chest_id) ?? null : null,
    low: it.min_threshold > 0 && it.quantity < it.min_threshold,
  }));
  return { items };
});

const stockItemSchema = z.object({
  id: z.string().uuid().optional(),
  chest_id: z.string().uuid().nullable().optional(),
  item_name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(0),
  unit: z.string().trim().max(20).default("pcs"),
  min_threshold: z.number().int().min(0).default(0),
});

export const upsertStockItem = createServerFn({ method: "POST" })
  .inputValidator((input) => stockItemSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const payload = {
      chest_id: data.chest_id ?? null,
      item_name: data.item_name,
      quantity: data.quantity,
      unit: data.unit,
      min_threshold: data.min_threshold,
      updated_by_discord_id: user.discordId,
    };
    if (data.id) {
      const { error } = await db.from("stock_items").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("stock_items").insert(payload);
      if (error) throw new Error(error.message);
    }
    await logAction("logistics_stock_upsert", user.discordId, data);
    return { ok: true };
  });

export const deleteStockItem = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { error } = await db.from("stock_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("logistics_stock_delete", user.discordId, data);
    return { ok: true };
  });

export const adjustStock = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), delta: z.number().int() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: row, error: e1 } = await db
      .from("stock_items")
      .select("quantity")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!row) throw new Error("NOT_FOUND");
    const next = Math.max(0, (row.quantity ?? 0) + data.delta);
    const { error } = await db
      .from("stock_items")
      .update({ quantity: next, updated_by_discord_id: user.discordId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("logistics_stock_adjust", user.discordId, { ...data, next });
    return { ok: true, quantity: next };
  });

// ---------- Demandes de matériel ----------

const createRequestSchema = z.object({
  itemName: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const createMaterialRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => createRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();
    if (!isFactionMember(user)) throw new Error("FORBIDDEN");
    const { error } = await db.from("material_requests").insert({
      member_discord_id: user.discordId,
      item_name: data.itemName,
      quantity: data.quantity,
      reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    await logAction("logistics_request_create", user.discordId, data);
    return { ok: true };
  });

async function enrichRequests(rows: any[]) {
  const ids = Array.from(new Set(rows.map((r) => r.member_discord_id)));
  if (!ids.length) return rows;
  const { data: members } = await db
    .from("members")
    .select("discord_id, discord_username, ig_name, avatar_url")
    .in("discord_id", ids);
  const map = new Map((members ?? []).map((m) => [m.discord_id, m]));
  return rows.map((r) => ({ ...r, member: map.get(r.member_discord_id) ?? null }));
}

export const listMyMaterialRequests = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  if (!isFactionMember(user)) throw new Error("FORBIDDEN");
  const { data, error } = await db
    .from("material_requests")
    .select("*")
    .eq("member_discord_id", user.discordId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return { requests: data ?? [] };
});

export const listPendingMaterialRequests = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.edit");
  const { data, error } = await db
    .from("material_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return { requests: await enrichRequests(data ?? []) };
});

export const listAllMaterialRequests = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.edit");
  const { data, error } = await db
    .from("material_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { requests: await enrichRequests(data ?? []) };
});

const decideSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "delivered"]),
});

export const decideMaterialRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => decideSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { data: req, error: e1 } = await db
      .from("material_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!req) throw new Error("NOT_FOUND");

    const patch: {
      status: string;
      decided_by_discord_id: string;
      decided_by_username: string | null;
      decided_at: string;
      stock_item_id?: string | null;
      delivered_at?: string;
    } = {
      status: data.decision,
      decided_by_discord_id: user.discordId,
      decided_by_username: user.username ?? null,
      decided_at: new Date().toISOString(),
    };

    let stockItemId: string | null = req.stock_item_id ?? null;

    if (data.decision === "delivered") {
      // Look up stock item by id if linked, else by item_name (first match).
      let stock: { id: string; quantity: number } | null = null;
      if (stockItemId) {
        const r = await db.from("stock_items").select("id, quantity").eq("id", stockItemId).maybeSingle();
        if (r.data) stock = r.data;
      }
      if (!stock) {
        const r = await db
          .from("stock_items")
          .select("id, quantity")
          .eq("item_name", req.item_name)
          .order("quantity", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (r.data) stock = r.data;
      }
      if (stock) {
        const next = Math.max(0, (stock.quantity ?? 0) - req.quantity);
        const { error: eUpd } = await db
          .from("stock_items")
          .update({ quantity: next, updated_by_discord_id: user.discordId })
          .eq("id", stock.id);
        if (eUpd) throw new Error(eUpd.message);
        stockItemId = stock.id;
        patch.stock_item_id = stock.id;
      }
      patch.delivered_at = new Date().toISOString();
    }

    const { error } = await db.from("material_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction("logistics_request_decide", user.discordId, { ...data, stockItemId });
    return { ok: true };
  });
