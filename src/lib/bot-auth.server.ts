/**
 * Auth + CORS helpers for /api/public/bot/* endpoints.
 * Bot calls authenticate via the `x-bot-key` header matching BOT_API_KEY.
 */
import { timingSafeEqual } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-bot-key",
  "Access-Control-Max-Age": "86400",
} as const;

export const corsHeaders = CORS;

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export function requireBotAuth(request: Request): Response | null {
  const provided = request.headers.get("x-bot-key");
  const expected = process.env.BOT_API_KEY;
  if (!expected) return json({ error: "BOT_API_KEY not configured" }, 500);
  if (!provided) return json({ error: "Unauthorized" }, 401);

  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  // timingSafeEqual requires equal-length buffers. To avoid leaking the
  // expected key's length, perform an equivalent-cost dummy comparison
  // when lengths differ and still return 401.
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return json({ error: "Unauthorized" }, 401);
  }

  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

