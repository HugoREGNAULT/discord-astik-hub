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

// ---------------------------------------------------------------------------
// Import CSV depuis la page (TEMPORAIRE — à retirer une fois l'import terminé).
// Détection automatique des colonnes (pseudo IG / Discord / âge / date) pour
// supporter les formats Google Forms hétérogènes.
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseLegacyDate(s: string): string | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
  return null;
}

function sourceFromFilename(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("rejoindre")) return "PunkAstik · Rejoindre l'aventure";
  if (n.includes("newdawn")) return "NewDawn";
  if (n.includes("astral")) return n.includes("gform") ? "AstralFaction · GForm" : "AstralFaction";
  if (n.includes("punkastik"))
    return n.includes("gform") ? "PunkAstik · GForm" : "PunkAstik · Formulaire";
  return (
    name
      .replace(/\.csv$/i, "")
      .replace(/\(réponses\).*$/i, "")
      .trim() || "Import CSV"
  );
}

const importSchema = z.object({
  filename: z.string().min(1).max(300),
  content: z.string().min(1).max(20_000_000),
});

export const importLegacyCsv = createServerFn({ method: "POST" })
  .inputValidator((input) => importSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("admin.access");
    const rows = parseCsv(data.content);
    if (rows.length < 2) throw new Error("CSV vide ou sans réponses.");
    const headers = rows[0].map((h) => h.trim());

    const idxDiscord = headers.findIndex((h) => /discord|\bdsc\b/i.test(h));
    const idxIg = headers.findIndex(
      (h, i) =>
        i !== idxDiscord && (/minecraft/i.test(h) || (/pseudo/i.test(h) && /\big\b/i.test(h))),
    );
    const idxAge = headers.findIndex((h) => /âge|\bage\b|ageee/i.test(h));
    const idxDate = headers.findIndex((h) => /^submitted at$|horodateur/i.test(h));
    const source = sourceFromFilename(data.filename);

    const get = (r: string[], idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
    const records: Array<{
      source: string;
      submitted_at: string | null;
      discord_name: string | null;
      ig_name: string | null;
      age: number | null;
      raw: Record<string, string>;
      contact_status: ContactStatus;
    }> = [];

    for (const r of rows.slice(1)) {
      const ig = get(r, idxIg);
      const dc = get(r, idxDiscord);
      if (!ig && !dc) continue;
      const ageM = get(r, idxAge).match(/\d{1,3}/);
      let age = ageM ? parseInt(ageM[0], 10) : null;
      if (age != null && (age < 5 || age > 110)) age = null;
      const raw: Record<string, string> = {};
      headers.forEach((h, i) => {
        const v = (r[i] ?? "").trim();
        if (h && v) raw[h] = v;
      });
      records.push({
        source,
        submitted_at: parseLegacyDate(get(r, idxDate)),
        discord_name: dc || null,
        ig_name: ig || null,
        age,
        raw,
        contact_status: "to_contact",
      });
    }

    // Remplace la source (ré-importer un même fichier ne crée pas de doublons).
    await db.from("legacy_applications").delete().eq("source", source);
    if (records.length > 0) {
      const ins = await db.from("legacy_applications").insert(records as never);
      if (ins.error) throw new Error(ins.error.message);
    }
    await logAction("legacy_import", staff.discordId, {
      source,
      count: records.length,
      filename: data.filename,
    });
    return { ok: true, source, count: records.length };
  });
