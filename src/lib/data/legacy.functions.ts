/**
 * Backlog des anciennes candidatures (import CSV multi-factions).
 * Réservé au haut staff (admin.access). Suivi de prise de contact.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

/** Distance de Levenshtein (itérative, O(n*m)). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = i;
    for (let j = 1; j <= b.length; j++) {
      const ins = cur + 1;
      const del = prev[j] + 1;
      const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      prev[j - 1] = cur;
      cur = Math.min(ins, del, sub);
    }
    prev[b.length] = cur;
  }
  return prev[b.length];
}

/** Similarité 0..1 (1 = identique). */
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export type ContactStatus = "to_contact" | "contacted" | "do_not_contact" | "already_member";

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
  mojang_status: "valid" | "not_found" | null;
  mojang_uuid: string | null;
  mojang_current_name: string | null;
  mojang_checked_at: string | null;
  paladium_status: "found" | "not_found" | "error" | null;
  paladium_faction: string | null;
  paladium_level: number | null;
  paladium_first_join: string | null;
  paladium_last_seen: string | null;
  paladium_money: number | null;
  paladium_jobs: Record<string, number> | null;
  paladium_job_total: number | null;
  paladium_played_v11: boolean | null;
  paladium_checked_at: string | null;
  /** Calculé à la volée : le pseudo IG correspond à une entrée blacklist (mc_name). */
  is_blacklisted?: boolean;
  /** Calculé à la volée : le pseudo correspond à un membre actif de la PunkAstik. */
  is_member?: boolean;
}

const listSchema = z
  .object({
    status: z.enum(["to_contact", "contacted", "do_not_contact", "already_member"]).optional(),
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
    const [res, bl, mem] = await Promise.all([
      q.order("submitted_at", { ascending: false, nullsFirst: false }).limit(3000),
      db.from("blacklist").select("mc_name, added_by_username"),
      db.from("members").select("ig_name, mc_uuid").eq("status", "active"),
    ]);
    if (res.error) throw new Error(res.error.message);

    // Liste de pseudos blacklistés (mc_name uniquement — c'est le "pseudo" disponible).
    const blNames = Array.from(
      new Set(
        (bl.data ?? [])
          .map((b) => (b.mc_name ?? "").toLowerCase().trim())
          .filter((s) => s.length >= 3),
      ),
    );
    const blSet = new Set(blNames);

    // Membres actuels (status actif) — pour le badge "déjà membre" automatique.
    const memberNames = new Set(
      (mem.data ?? [])
        .map((m) => (m.ig_name ?? "").toLowerCase().trim())
        .filter((s) => s.length >= 3),
    );
    const memberUuids = new Set(
      (mem.data ?? [])
        .map((m) => (m.mc_uuid ?? "").replace(/-/g, "").toLowerCase())
        .filter((s) => s.length === 32),
    );

    const rows = (res.data ?? []) as unknown as LegacyApplication[];
    for (const r of rows) {
      const candidates = [r.ig_name, r.discord_name, r.mojang_current_name]
        .map((s) => (s ?? "").toLowerCase().trim())
        .filter((s) => s.length >= 3);
      let hit = false;
      for (const c of candidates) {
        if (blSet.has(c)) {
          hit = true;
          break;
        }
        for (const b of blNames) {
          if (similarity(c, b) >= 0.8) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      r.is_blacklisted = hit;

      const igl = (r.ig_name ?? "").toLowerCase().trim();
      const curl = (r.mojang_current_name ?? "").toLowerCase().trim();
      const uul = (r.mojang_uuid ?? "").replace(/-/g, "").toLowerCase();
      r.is_member =
        (igl.length >= 3 && memberNames.has(igl)) ||
        (curl.length >= 3 && memberNames.has(curl)) ||
        (uul.length === 32 && memberUuids.has(uul));
    }
    return rows;
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
    already_member: 0,
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
  status: z.enum(["to_contact", "contacted", "do_not_contact", "already_member"]),
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

// ---------------------------------------------------------------------------
// Vérification Mojang par lots (API bulk : 10 pseudos/requête). Appelée en
// boucle depuis la page jusqu'à `remaining` = 0.
// ---------------------------------------------------------------------------

const mojangSchema = z.object({
  limit: z.number().int().min(1).max(300).optional().default(150),
});

async function remainingMojang(): Promise<number> {
  const r = await db
    .from("legacy_applications")
    .select("id", { count: "exact", head: true })
    .is("mojang_checked_at", null)
    .not("ig_name", "is", null);
  return r.count ?? 0;
}

export const verifyLegacyMojang = createServerFn({ method: "POST" })
  .inputValidator((input) => mojangSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await requirePermission("admin.access");
    const res = await db
      .from("legacy_applications")
      .select("id, ig_name")
      .is("mojang_checked_at", null)
      .not("ig_name", "is", null)
      .limit(data.limit);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as Array<{ id: string; ig_name: string | null }>;
    if (rows.length === 0) {
      return { processed: 0, remaining: await remainingMojang(), valid: 0, notFound: 0 };
    }

    // Dédoublonne par pseudo (insensible casse) pour limiter les requêtes.
    const byName = new Map<string, { display: string; ids: string[] }>();
    for (const r of rows) {
      const n = (r.ig_name ?? "").trim();
      if (!n) continue;
      const k = n.toLowerCase();
      const e = byName.get(k);
      if (e) e.ids.push(r.id);
      else byName.set(k, { display: n, ids: [r.id] });
    }
    const entries = Array.from(byName.entries());

    const resolved = new Map<string, { uuid: string; name: string }>();
    for (let i = 0; i < entries.length; i += 10) {
      const slice = entries.slice(i, i + 10).map(([, v]) => v.display);
      try {
        const r = await fetch("https://api.mojang.com/profiles/minecraft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slice),
        });
        if (r.ok) {
          const arr = (await r.json()) as Array<{ id?: string; name?: string }>;
          for (const p of arr) {
            if (p?.id && p?.name) resolved.set(p.name.toLowerCase(), { uuid: p.id, name: p.name });
          }
        }
      } catch {
        /* lot ignoré, sera re-tenté (mojang_checked_at reste null) */
      }
    }

    // Fallback : pour les pseudos non résolus, tente ashcon (résout les anciens
    // pseudos vers le compte actuel — utile si la personne a changé de pseudo).
    const unresolved = entries.filter(([k]) => !resolved.has(k));
    const renamed = new Map<string, { uuid: string; name: string }>();
    await Promise.all(
      unresolved.map(async ([k, v]) => {
        try {
          const r = await fetch(
            `https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(v.display)}`,
          );
          if (!r.ok) return;
          const j = (await r.json()) as { uuid?: string; username?: string };
          if (j?.uuid && j?.username) {
            const uuid = j.uuid.replace(/-/g, "");
            renamed.set(k, { uuid, name: j.username });
          }
        } catch {
          /* ignore */
        }
      }),
    );

    let valid = 0;
    let notFound = 0;
    const now = new Date().toISOString();
    for (const [k, v] of entries) {
      const hit = resolved.get(k);
      if (hit) {
        valid += v.ids.length;
        await db
          .from("legacy_applications")
          .update({
            mojang_status: "valid",
            mojang_uuid: hit.uuid,
            mojang_current_name: hit.name,
            mojang_checked_at: now,
          } as never)
          .in("id", v.ids);
      } else {
        const ren = renamed.get(k);
        if (ren) {
          // Pseudo changé : on stocke le pseudo actuel mais on garde "not_found"
          // pour signaler le changement à l'UI.
          valid += v.ids.length;
          await db
            .from("legacy_applications")
            .update({
              mojang_status: "not_found",
              mojang_uuid: ren.uuid,
              mojang_current_name: ren.name,
              mojang_checked_at: now,
            } as never)
            .in("id", v.ids);
        } else {
          notFound += v.ids.length;
          await db
            .from("legacy_applications")
            .update({ mojang_status: "not_found", mojang_checked_at: now } as never)
            .in("id", v.ids);
        }
      }
    }

    return { processed: valid + notFound, remaining: await remainingMojang(), valid, notFound };
  });

// ---------------------------------------------------------------------------
// Stats Paladium par lots (faction actuelle, niveau, ancienneté) pour repérer
// les joueurs encore actifs. 1 requête/joueur (pas de bulk), respecte le rate
// limit. Appelée en boucle depuis la page jusqu'à `remaining` = 0.
// ---------------------------------------------------------------------------

const paladiumSchema = z.object({
  limit: z.number().int().min(1).max(30).optional().default(12),
});

// À (re)traiter : pas encore de verdict V11 (played_v11 NULL), et soit jamais
// vérifié (status NULL) soit déjà trouvé (status 'found' → on l'enrichit avec
// argent/métiers). Les 'not_found' sont laissés tranquilles.
async function remainingPaladium(): Promise<number> {
  const r = await db
    .from("legacy_applications")
    .select("id", { count: "exact", head: true })
    .is("paladium_played_v11", null)
    .or("paladium_status.is.null,paladium_status.eq.found")
    .or("mojang_uuid.not.is.null,ig_name.not.is.null");
  return r.count ?? 0;
}

export const verifyLegacyPaladium = createServerFn({ method: "POST" })
  .inputValidator((input) => paladiumSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await requirePermission("admin.access");
    const { fetchPaladium, dashUuid, PaladiumServerError } =
      await import("@/lib/paladium/paladium.server");
    const res = await db
      .from("legacy_applications")
      .select("id, ig_name, mojang_uuid")
      .is("paladium_played_v11", null)
      .or("paladium_status.is.null,paladium_status.eq.found")
      .or("mojang_uuid.not.is.null,ig_name.not.is.null")
      .limit(data.limit);
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as Array<{
      id: string;
      ig_name: string | null;
      mojang_uuid: string | null;
    }>;
    if (rows.length === 0) {
      return { processed: 0, remaining: await remainingPaladium(), found: 0, rateLimited: false };
    }

    const pickStr = (o: Record<string, unknown>, ...keys: string[]): string | null => {
      for (const k of keys) {
        const v = o[k];
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number" && Number.isFinite(v)) return String(v);
      }
      return null;
    };
    const pickNum = (o: Record<string, unknown>, ...keys: string[]): number | null => {
      for (const k of keys) {
        const v = o[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
      }
      return null;
    };

    const now = new Date().toISOString();
    let found = 0;
    let rateLimited = false;
    for (const r of rows) {
      // UUID Mojang d'abord (plus fiable), puis pseudo en repli.
      const ids: string[] = [];
      if (r.mojang_uuid) ids.push(dashUuid(r.mojang_uuid));
      if (r.ig_name?.trim()) ids.push(r.ig_name.trim());
      let profile: Record<string, unknown> | null = null;
      let usedId: string | null = null;
      let stop = false;
      for (const id of ids) {
        try {
          const pr = await fetchPaladium(`/v1/paladium/player/profile/${encodeURIComponent(id)}`);
          profile = (pr.data ?? null) as Record<string, unknown> | null;
          if (pr.rate.remaining != null && pr.rate.remaining <= 2) {
            await new Promise((rsv) => setTimeout(rsv, 1500));
          }
          if (profile) {
            usedId = id;
            break;
          }
        } catch (e) {
          if (e instanceof PaladiumServerError && e.status === 404) continue;
          if (
            e instanceof PaladiumServerError &&
            (e.status === 429 || e.status === 0 || e.status >= 500)
          ) {
            stop = true;
            break;
          }
          // autre erreur : on passe au candidat suivant
        }
      }
      if (stop) {
        rateLimited = true;
        break; // on retentera ce lot au prochain appel (checked_at reste null)
      }

      let update: Record<string, unknown>;
      if (profile) {
        found++;
        const faction = pickStr(profile, "factionName", "faction", "guildName", "guild");
        const money = pickNum(profile, "money", "coins", "balance");
        // Métiers (reset chaque saison) via un 2e appel. Forme officielle :
        // { miner: { level, xp }, farmer: {...}, ... } ; on tolère aussi { jobs: [...] }.
        const jobs: Record<string, number> = {};
        let jobTotal = 0;
        try {
          const jr = await fetchPaladium(
            `/v1/paladium/player/profile/${encodeURIComponent(usedId ?? ids[0])}/jobs`,
          );
          const jraw = (jr.data ?? {}) as Record<string, unknown>;
          const arr = (jraw as { jobs?: Array<{ name?: string; level?: number }> }).jobs;
          if (Array.isArray(arr)) {
            for (const j of arr) {
              const lvl = Number(j?.level ?? 0);
              if (j?.name && lvl > 0) {
                jobs[String(j.name).toLowerCase()] = lvl;
                jobTotal += lvl;
              }
            }
          } else {
            for (const [name, v] of Object.entries(jraw)) {
              if (v && typeof v === "object") {
                const lvl = Number((v as { level?: number }).level ?? 0);
                if (lvl > 0) {
                  jobs[name.toLowerCase()] = lvl;
                  jobTotal += lvl;
                }
              }
            }
          }
          if (jr.rate.remaining != null && jr.rate.remaining <= 2) {
            await new Promise((rsv) => setTimeout(rsv, 1500));
          }
        } catch (e) {
          if (
            e instanceof PaladiumServerError &&
            (e.status === 429 || e.status === 0 || e.status >= 500)
          ) {
            rateLimited = true;
            break; // jobs rate-limité : on retentera ce joueur (played_v11 reste null)
          }
          // autre erreur jobs : on continue avec jobTotal = 0
        }
        const playedV11 = (money != null && money > 0) || jobTotal > 0 || !!faction;
        update = {
          paladium_status: "found",
          paladium_faction: faction,
          paladium_first_join: pickStr(
            profile,
            "firstJoin",
            "firstSeen",
            "createdAt",
            "created_at",
          ),
          paladium_money: money,
          paladium_jobs: Object.keys(jobs).length ? jobs : null,
          paladium_job_total: jobTotal,
          paladium_played_v11: playedV11,
          paladium_checked_at: now,
        };
      } else {
        update = {
          paladium_status: "not_found",
          paladium_played_v11: false,
          paladium_checked_at: now,
        };
      }
      await db
        .from("legacy_applications")
        .update(update as never)
        .eq("id", r.id);
    }

    return { processed: rows.length, remaining: await remainingPaladium(), found, rateLimited };
  });
