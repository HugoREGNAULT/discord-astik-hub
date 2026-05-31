// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? "(no stack)"}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function record(source: string, error: unknown) {
  lastCapturedError = { error, at: Date.now() };
  // Log eagerly so the error is visible in worker logs even if the response
  // normalizer never picks it up.

  console.error(`[ssr-capture:${source}] ${formatError(error)}`);

  // Fire-and-forget : forward vers Discord (import dynamique pour éviter
  // tout cycle avec observability/log.server).
  import("@/lib/observability.server")
    .then(({ reportError }) => reportError(`ssr:${source}`, error))
    .catch(() => {
      /* silencieux */
    });
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) =>
    record("error", (event as ErrorEvent).error ?? event),
  );
  globalThis.addEventListener("unhandledrejection", (event) =>
    record("unhandledrejection", (event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

export function describeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}
