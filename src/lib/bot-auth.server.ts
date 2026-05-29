/**
 * Auth + CORS helpers for /api/public/bot/* endpoints.
 * Bot calls authenticate via the `x-bot-key` header matching BOT_API_KEY.
 */
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
  if (!provided || provided !== expected) return json({ error: "Unauthorized" }, 401);
  return null;
}
