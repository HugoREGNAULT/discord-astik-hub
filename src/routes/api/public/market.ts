// Endpoint prive pour l'outil HDV (market-paladium).
// Renvoie tout le catalogue HDV Paladium (catalogue + listings + priceAverage)
// en une requete. Protege par la cle MARKET_API_KEY (header `x-market-key`),
// sur le meme modele que /api/public/bot/* (BOT_API_KEY).
//
// Reutilise la cle Paladium serveur existante (PALADIUM_API_KEY) via fetchPaladium.
// Cache memoire 120 s : la doc Paladium recommande de cacher, et ca evite de
// marteler le quota partage du site sur des relances rapprochees.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { fetchPaladium } from "@/lib/paladium/paladium.server";

type MarketRate = { limit: number | null; remaining: number | null; reset: number | null };

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function requireMarketKey(request: Request): Response | null {
  const provided = request.headers.get("x-market-key");
  const expected = process.env.MARKET_API_KEY;
  if (!expected) return jsonResponse({ error: "MARKET_API_KEY not configured" }, 500);
  if (!provided) return jsonResponse({ error: "Unauthorized" }, 401);

  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  // timingSafeEqual exige des buffers de meme longueur ; comparaison factice de
  // cout equivalent quand les longueurs different, pour ne pas fuiter la longueur.
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}

type CacheEntry = { at: number; body: string };
let cache: CacheEntry | null = null;
const CACHE_MS = 120_000;

export const Route = createFileRoute("/api/public/market")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauth = requireMarketKey(request);
        if (unauth) return unauth;

        if (cache && Date.now() - cache.at < CACHE_MS) {
          return new Response(cache.body, {
            status: 200,
            headers: { "content-type": "application/json", "x-cache": "HIT" },
          });
        }

        const items: unknown[] = [];
        let rate: MarketRate = { limit: null, remaining: null, reset: null };
        const pageSize = 100;
        let offset = 0;
        let declaredTotal = 0;

        try {
          // Au plus 25 pages (= 2500 items) pour borner la conso de quota.
          for (let i = 0; i < 25; i++) {
            const { data, rate: r } = await fetchPaladium(
              `/v1/paladium/shop/market/items?limit=${pageSize}&offset=${offset}`,
            );
            rate = r;
            const page = data as { data?: unknown[]; totalCount?: number };
            const batch = page.data ?? [];
            items.push(...batch);
            declaredTotal = page.totalCount ?? items.length;
            offset += pageSize;
            if (batch.length < pageSize || offset >= declaredTotal) break;
          }
        } catch (err) {
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : "Paladium fetch failed",
              items,
              partial: true,
              rate,
            },
            502,
          );
        }

        const body = JSON.stringify({
          items,
          count: items.length,
          declaredTotal,
          rate, // X-RateLimit-Limit / Remaining / Reset de la derniere page
          fetchedAt: new Date().toISOString(),
        });
        cache = { at: Date.now(), body };
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/json", "x-cache": "MISS" },
        });
      },
    },
  },
});
