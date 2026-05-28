/**
 * Rate limiter in-memory simple (sliding window).
 * Suffisant pour bloquer un spam basique sur /api/auth/login.
 * Note : ne survit pas à un redémarrage worker — c'est acceptable pour ce use-case.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): {
  ok: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetIn: windowMs };
  }
  b.count += 1;
  const remaining = Math.max(0, max - b.count);
  return { ok: b.count <= max, remaining, resetIn: b.resetAt - now };
}

export function getClientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
