/**
 * Parsing CSV pour les sondages.
 * Supporte deux formats :
 *  1) Liste simple : `date,durée` par ligne (ex. `2026-06-15 20:00,90`)
 *  2) Matrice type Framadate / Google Forms / Doodle :
 *       Nom,E-mail,ven. 12 juin 2026 20:45 - 21:45,sam. 13 juin 2026 21:00 - 22:00,...
 *       Aizarde,gabin@…,Oui,Non,En cas de besoin,…
 */

export type Choice = "yes" | "maybe" | "no";

export type ListSlot = { value: string; duration: number };
export type ListResult = { mode: "list"; slots: ListSlot[] };

export type MatrixSlot = {
  header: string;
  /** "YYYY-MM-DDTHH:MM" — directement injectable dans <input type=datetime-local> */
  value: string;
  /** ISO complet en UTC pour matching en base */
  isoLocal: string;
  duration: number;
};
export type MatrixRow = {
  name: string;
  email: string | null;
  /** même longueur que slots, null = pas de réponse */
  choices: (Choice | null)[];
};
export type MatrixResult = {
  mode: "matrix";
  slots: MatrixSlot[];
  rows: MatrixRow[];
};

export type ParsedPollCsv = ListResult | MatrixResult;

/* ------------------------------ CSV tokenizer ----------------------------- */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === "," || c === ";" || c === "\t") {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/* ----------------------------- French date util --------------------------- */

const FR_MONTHS: Record<string, number> = {
  janv: 1,
  janvier: 1,
  fevr: 2,
  févr: 2,
  fevrier: 2,
  février: 2,
  mars: 3,
  avr: 4,
  avril: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  juillet: 7,
  aout: 8,
  août: 8,
  sept: 9,
  septembre: 9,
  oct: 10,
  octobre: 10,
  nov: 11,
  novembre: 11,
  dec: 12,
  déc: 12,
  decembre: 12,
  décembre: 12,
};

const FR_HEADER_RE =
  /(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseFrenchHeader(
  header: string,
): { value: string; isoLocal: string; duration: number } | null {
  const m = header.match(FR_HEADER_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const monthKey = m[2].toLowerCase().replace(/\.$/, "");
  const month = FR_MONTHS[monthKey];
  if (!month) return null;
  const year = Number(m[3]);
  const sh = Number(m[4]);
  const sm = Number(m[5]);
  const eh = Number(m[6]);
  const em = Number(m[7]);
  let duration = eh * 60 + em - (sh * 60 + sm);
  if (duration <= 0) duration += 24 * 60;
  if (duration < 15 || duration > 24 * 60) duration = 60;
  const value = `${year}-${pad(month)}-${pad(day)}T${pad(sh)}:${pad(sm)}`;
  // ISO local sans timezone (utilisé pour matching côté serveur)
  const isoLocal = `${value}:00`;
  return { value, isoLocal, duration };
}

function parseListDate(raw: string): string | null {
  const isoTry = new Date(raw);
  if (!isNaN(isoTry.getTime())) {
    return `${isoTry.getFullYear()}-${pad(isoTry.getMonth() + 1)}-${pad(isoTry.getDate())}T${pad(isoTry.getHours())}:${pad(isoTry.getMinutes())}`;
  }
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  return null;
}

function mapChoice(raw: string): Choice | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "oui" || v === "yes" || v === "y" || v === "ok" || v === "✓") return "yes";
  if (v === "non" || v === "no" || v === "n" || v === "x") return "no";
  if (
    v.startsWith("en cas") ||
    v === "peut-etre" ||
    v === "peut-être" ||
    v === "maybe" ||
    v === "?"
  )
    return "maybe";
  return null;
}

/* --------------------------------- API ----------------------------------- */

export function parsePollCsv(text: string): ParsedPollCsv {
  const grid = parseCsv(text);
  if (!grid.length) return { mode: "list", slots: [] };

  // Détection matrice : 1re ligne, 1re cellule ~ "Nom" et plusieurs colonnes parseables comme date FR
  const header = grid[0];
  const looksLikeMatrix =
    header.length >= 3 &&
    /^(nom|name|prénom|prenom)$/i.test(header[0].trim()) &&
    header.slice(1).some((h) => FR_HEADER_RE.test(h));

  if (looksLikeMatrix) {
    // Détecte colonne email
    const emailColIdx = header.findIndex((h, i) => i > 0 && /e[-\s]?mail|email/i.test(h));
    const slotCols: { idx: number; slot: MatrixSlot }[] = [];
    header.forEach((h, idx) => {
      if (idx === 0 || idx === emailColIdx) return;
      const parsed = parseFrenchHeader(h);
      if (parsed)
        slotCols.push({
          idx,
          slot: {
            header: h.trim(),
            value: parsed.value,
            isoLocal: parsed.isoLocal,
            duration: parsed.duration,
          },
        });
    });

    const rows: MatrixRow[] = [];
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      const name = (row[0] ?? "").trim();
      if (!name) continue;
      const email = emailColIdx >= 0 ? (row[emailColIdx] ?? "").trim() || null : null;
      const choices = slotCols.map((sc) => mapChoice(row[sc.idx] ?? ""));
      rows.push({ name, email, choices });
    }

    return { mode: "matrix", slots: slotCols.map((sc) => sc.slot), rows };
  }

  // Mode liste : ligne par créneau
  const slots: ListSlot[] = [];
  for (const row of grid) {
    const raw = (row[0] ?? "").trim();
    if (!raw) continue;
    const value = parseListDate(raw);
    if (!value) continue;
    const dur = Number(row[1]);
    const duration =
      Number.isFinite(dur) && dur >= 15 && dur <= 1440 ? Math.round(dur) : 60;
    slots.push({ value, duration });
  }
  return { mode: "list", slots };
}
