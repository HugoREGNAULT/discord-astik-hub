import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { RouteError } from "@/components/RouteError";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PunkAstik" },
      {
        name: "description",
        content: "PunkAstik Hub is a web application for managing Discord server roles and data.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "PunkAstik" },
      {
        property: "og:description",
        content: "PunkAstik Hub is a web application for managing Discord server roles and data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "PunkAstik" },
      {
        name: "twitter:description",
        content: "PunkAstik Hub is a web application for managing Discord server roles and data.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/84b63b95-255e-423e-865c-825c0ee85554/id-preview-82518a41--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app-1779971064504.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/84b63b95-255e-423e-865c-825c0ee85554/id-preview-82518a41--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app-1779971064504.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RouteError,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Inline script applies the saved theme before first paint to avoid flash.
  // IMPORTANT: ce script est autorisé par la CSP via un hash SHA-256 dans src/start.ts.
  // Si vous modifiez le contenu de `themeInit`, recalculez le hash (SHA-256, base64)
  // et mettez à jour la directive `script-src 'sha256-...='` dans src/start.ts.
  const themeInit = `(function(){try{var t=localStorage.getItem('punkastik:theme')||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="bottom-center" richColors />
    </QueryClientProvider>
  );
}
