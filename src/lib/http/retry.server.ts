/**
 * fetch avec retry + backoff exponentiel + respect du header Retry-After.
 * Conçu pour les APIs externes capricieuses (Mojang, Discord).
 */

export interface RetryOptions {
  retries?: number; // tentatives au-delà de la première
  baseDelayMs?: number; // base du backoff
  maxDelayMs?: number; // plafond
  timeoutMs?: number; // timeout par tentative
  retryOn?: (status: number) => boolean;
}

const DEFAULTS: Required<Omit<RetryOptions, "retryOn">> = {
  retries: 3,
  baseDelayMs: 300,
  maxDelayMs: 4000,
  timeoutMs: 10_000,
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultRetryOn(status: number) {
  // 429 (rate limit) + 5xx
  return status === 429 || (status >= 500 && status <= 599);
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const o = { ...DEFAULTS, ...opts };
  const retryOn = opts.retryOn ?? defaultRetryOn;

  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= o.retries) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), o.timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      clearTimeout(t);

      if (res.ok || !retryOn(res.status)) return res;

      // Retry-After (secondes ou date HTTP)
      let waitMs = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
      const ra = res.headers.get("retry-after");
      if (ra) {
        const asNum = Number(ra);
        if (!Number.isNaN(asNum)) waitMs = Math.min(o.maxDelayMs, asNum * 1000);
      }
      if (attempt === o.retries) return res; // dernière tentative : on rend la mauvaise réponse
      await sleep(waitMs + Math.random() * 150);
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt === o.retries) throw e;
      const waitMs = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
      await sleep(waitMs + Math.random() * 150);
    }
    attempt++;
  }
  throw lastErr ?? new Error("fetchWithRetry: exhausted");
}
