// Server-only Paladium API helper. Reads PALADIUM_API_KEY from process.env at call time.

const PALADIUM_BASE = "https://api.paladium.games";

/**
 * Convertit un UUID Minecraft (avec ou sans tirets) au format canonique
 * 8-4-4-4-12 attendu par l'API Paladium. Renvoie la valeur telle quelle
 * si elle n'est pas un UUID 32 hex.
 */
export function dashUuid(uuid: string): string {
  const v = uuid.replace(/-/g, "");
  if (v.length !== 32 || !/^[0-9a-fA-F]+$/.test(v)) return uuid;
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}`;
}


export class PaladiumServerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PaladiumServerError";
  }
}

export type PaladiumFetchResult = {
  data: unknown;
  rate: { limit: number | null; remaining: number | null; reset: number | null };
};

export async function fetchPaladium(path: string): Promise<PaladiumFetchResult> {
  const key = process.env.PALADIUM_API_KEY?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  let res: Response;
  try {
    res = await fetch(`${PALADIUM_BASE}${path}`, { headers });
  } catch (err) {
    throw new PaladiumServerError(
      err instanceof Error ? err.message : "Network error reaching Paladium API",
      0,
    );
  }

  const num = (v: string | null) => (v == null || v === "" ? null : Number(v));
  const rate = {
    limit: num(res.headers.get("x-ratelimit-limit")),
    remaining: num(res.headers.get("x-ratelimit-remaining")),
    reset: num(res.headers.get("x-ratelimit-reset")),
  };

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new PaladiumServerError(
      `Paladium API ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      res.status,
    );
  }
  return { data: await res.json(), rate };
}
