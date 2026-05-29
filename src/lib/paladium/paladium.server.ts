// Server-only Paladium API helper. Reads PALADIUM_API_KEY from process.env at call time.

const PALADIUM_BASE = "https://api.paladium.games";

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
