/**
 * Backlog des anciennes candidatures (import CSV multi-factions).
 * Réservé au haut staff (admin.access). Suivi de prise de contact.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

export type ContactStatus = "to_contact" | "contacted" | "do_not_contact";

export interface LegacyApplication {
  id: string;
  source: string;
  submitted_at: string | null;
  discord_name: string | null;
  ig_name: string | null;
  age: number | null;
  raw: Record<string, string>;
  contact_status: ContactStatus;
  contact_note: string | null;
  contact_updated_at: string | null;
  contact_updated_by_username: string | null;
  created_at: string;
}

const listSchema = z
  .object({
    status: z.enum(["to_contact", "contacted", "do_not_contact"]).optional(),
    source: z.string().max(200).optional(),
    search: z.string().max(100).optional(),
  })
  .optional()
  .default({});

export const listLegacyApplications = createServerFn({ method: "GET" })
  .inputValidator((input) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await requirePermission("admin.access");
    let q = db.from("legacy_applications").select("*");
    if (data.status) q = q.eq("contact_status", data.status);
    if (data.source) q = q.eq("source", data.source);
    const s = data.search?.trim();
    if (s) q = q.or(`ig_name.ilike.%${s}%,discord_name.ilike.%${s}%`);
    const res = await q.order("submitted_at", { ascending: false, nullsFirst: false }).limit(3000);
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as unknown as LegacyApplication[];
  });

export const getLegacyOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("admin.access");
  const res = await db.from("legacy_applications").select("source, contact_status");
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as Array<{ source: string; contact_status: ContactStatus }>;
  const sources = new Map<string, number>();
  const statuses: Record<ContactStatus, number> = {
    to_contact: 0,
    contacted: 0,
    do_not_contact: 0,
  };
  for (const r of rows) {
    sources.set(r.source, (sources.get(r.source) ?? 0) + 1);
    if (r.contact_status in statuses) statuses[r.contact_status]++;
  }
  return {
    total: rows.length,
    statuses,
    sources: Array.from(sources.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
  };
});

const setStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["to_contact", "contacted", "do_not_contact"]),
  note: z.string().trim().max(2000).optional().default(""),
});

export const setLegacyContactStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => setStatusSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("admin.access");
    const upd = await db
      .from("legacy_applications")
      .update({
        contact_status: data.status,
        contact_note: data.note || null,
        contact_updated_at: new Date().toISOString(),
        contact_updated_by_discord_id: staff.discordId,
        contact_updated_by_username: staff.username,
      })
      .eq("id", data.id);
    if (upd.error) throw new Error(upd.error.message);
    await logAction("legacy_contact_status", staff.discordId, {
      id: data.id,
      status: data.status,
    });
    return { ok: true };
  });
