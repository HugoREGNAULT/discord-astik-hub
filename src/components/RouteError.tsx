import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toUserMessage } from "@/lib/errors";
import { reportClientError } from "@/lib/observability.functions";

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[route-error]", error);
  const router = useRouter();
  const isDev = import.meta.env.DEV;
  const message = toUserMessage(error);
  const report = useServerFn(reportClientError);

  useEffect(() => {
    if (!error) return;
    report({
      data: {
        context: "route-error",
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }).catch(() => {
      /* silencieux */
    });
  }, [error, report]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu s'afficher
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {isDev && error?.stack && (
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-destructive whitespace-pre-wrap break-words">
            {error.stack}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export default RouteError;
