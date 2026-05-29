import "./lib/error-capture";

import { consumeLastCapturedError, describeError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const IS_DEV = process.env.NODE_ENV !== "production";

function logSsrFailure(
  reqId: string,
  request: Request,
  error: unknown,
  origin: "thrown" | "h3-swallowed",
) {
  const d = describeError(error);

  console.error(
    `[ssr-failure id=${reqId} origin=${origin} method=${request.method} url=${request.url}]\n` +
      `${d.name}: ${d.message}\n${d.stack ?? "(no stack)"}`,
  );
}

function buildErrorResponse(reqId: string, error: unknown): Response {
  const d = describeError(error);
  return new Response(
    renderErrorPage({
      title: "Erreur serveur",
      message: `Le rendu de la page a échoué (${d.name}). Réessaie ou retourne à l'accueil.`,
      detail: IS_DEV ? `${d.name}: ${d.message}\n\n${d.stack ?? ""}` : undefined,
      requestId: reqId,
    }),
    { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  reqId: string,
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const captured = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logSsrFailure(reqId, request, captured, "h3-swallowed");
  return buildErrorResponse(reqId, captured);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const reqId =
      (typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID()) ||
      Math.random().toString(36).slice(2, 10);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(reqId, request, response);
    } catch (error) {
      logSsrFailure(reqId, request, error, "thrown");
      return buildErrorResponse(reqId, error);
    }
  },
};
