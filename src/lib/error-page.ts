interface ErrorPageOpts {
  title?: string;
  message?: string;
  detail?: string;
  requestId?: string;
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderErrorPage(opts: ErrorPageOpts = {}): string {
  const title = opts.title ?? "Erreur serveur";
  const message =
    opts.message ??
    "Une erreur est survenue côté serveur pendant le rendu de la page. Réessaie dans un instant.";
  const detail = opts.detail ? `<pre class="detail">${escape(opts.detail)}</pre>` : "";
  const reqId = opts.requestId ? `<p class="rid">Référence : ${escape(opts.requestId)}</p>` : "";
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0b0b12; color: #e5e7eb; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 36rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #9ca3af; margin: 0 0 1rem; }
      .rid { font-size: 12px; color: #6b7280; }
      .detail { text-align: left; background: #111827; color: #fca5a5; padding: 1rem; border-radius: 0.5rem; overflow: auto; max-height: 18rem; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #6366f1; color: #fff; }
      .secondary { background: transparent; color: #e5e7eb; border-color: #374151; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escape(title)}</h1>
      <p>${escape(message)}</p>
      ${reqId}
      ${detail}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Accueil</a>
      </div>
    </div>
  </body>
</html>`;
}
