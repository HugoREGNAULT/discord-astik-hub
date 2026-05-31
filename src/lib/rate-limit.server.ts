/**
 * Rate limiter in-memory simple (fenêtre fixe).
 * Suffisant pour bloquer un spam basique sur /api/auth/login et quelques
 * server functions coûteuses.
 *
 * LIMITES CONNUES (dette technique à adresser pour une vraie robustesse prod) :
 *  - L'état (Map `buckets`) vit uniquement en mémoire du worker courant et
 *    ne survit donc pas à un redémarrage / redéploiement.
 *  - Il n'est PAS partagé entre instances : sur une plateforme multi-worker
 *    (Cloudflare Workers, autoscaling, etc.), chaque instance a son propre
 *    compteur, donc la limite effective est multipliée par le nombre
 *    d'instances actives.
 *  - Pas de persistance, pas de TTL côté infra : la Map grossit jusqu'au
 *    prochain GC de bucket expiré (au prochain hit sur la même clé).
 *
 * Pour une protection sérieuse en production, prévoir un backend partagé :
 *   - table Supabase (compteur + fenêtre) avec upsert atomique, ou
 *   - Redis/Upstash (INCR + EXPIRE) pour de la latence faible.
 * Non implémenté ici — documenté volontairement.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): {
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
