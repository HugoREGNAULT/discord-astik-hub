/**
 * GET /api/auth/test-login?key=SECRET&id=1&name=Eclipse&next=/candidature
 *
 * Crée une session de COMPTE DE TEST (candidat non-privilégié) SANS passer par
 * Discord — uniquement pour la QA du parcours candidat.
 *
 * Garde-fous (voir aussi la conversation de mise en place) :
 *  - DÉSACTIVÉ par défaut : renvoie 404 tant que `TEST_LOGIN_SECRET` (≥16 car.)
 *    n'est pas défini côté serveur (Lovable → Secrets).
 *  - Accès par secret fort uniquement (comparaison à temps constant) + rate-limit.
 *  - `discord_id` FORCÉ avec le préfixe `test-` → impossible d'usurper un vrai
 *    compte Discord (dont l'id est purement numérique).
 *  - `roleIds: []` → AUCUN rôle : le compte peut candidater / voir /me, mais n'a
 *    accès à RIEN du staff (canAccess renvoie false partout).
 *  - Comptes identifiables/nettoyables : `DELETE … WHERE discord_id LIKE 'test-%'`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { setSessionData } from "@/lib/auth/session.server";
import { rateLimit, getClientIp } from "@/lib/rate-limit.server";

/** Comparaison à temps constant (évite de fuiter le secret par timing). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/auth/test-login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.TEST_LOGIN_SECRET ?? "";
        // Endpoint inexistant tant qu'aucun secret robuste n'est configuré.
        if (secret.length < 16) {
          return new Response("Not found", { status: 404 });
        }

        const ip = getClientIp(request);
        const rl = rateLimit(`test-login:${ip}`, 10, 5 * 60 * 1000);
        if (!rl.ok) {
          return new Response(
            `Trop de tentatives. Réessaie dans ${Math.ceil(rl.resetIn / 1000)}s.`,
            {
              status: 429,
              headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
            },
          );
        }

        const url = new URL(request.url);
        if (!timingSafeEqualStr(url.searchParams.get("key") ?? "", secret)) {
          return new Response("Forbidden", { status: 403 });
        }

        // Identifiant de test : préfixe "test-" + slug borné (a-z0-9-).
        const rawId =
          (url.searchParams.get("id") ?? "1")
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 24) || "1";
        const discordId = `test-${rawId}`;
        const rawName = (url.searchParams.get("name") ?? "").trim().slice(0, 32);
        const username = rawName.length > 0 ? rawName : `TestCandidat ${rawId}`;

        const rawNext = url.searchParams.get("next") || "/candidature";
        const nextPath =
          rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/candidature";

        await setSessionData({
          discordId,
          username,
          globalName: username,
          avatar: null,
          accessToken: "",
          refreshToken: "",
          expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
          roleIds: [], // AUCUN rôle → candidat lambda, zéro accès staff.
          rolesRefreshedAt: Date.now(),
        });

        return new Response(null, { status: 302, headers: { Location: nextPath } });
      },
    },
  },
});
