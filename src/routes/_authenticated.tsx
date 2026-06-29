import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getSessionStatus, getCurrentUser } from "@/lib/auth/session.functions";
import { recordView } from "@/lib/data/usage.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { authenticated } = await getSessionStatus();
    if (!authenticated) throw redirect({ to: "/login" });
  },
  loader: async () => {
    try {
      return await getCurrentUser();
    } catch {
      return null;
    }
  },
  head: () => ({}),
  component: AuthLayout,
});

// Libellés lisibles par segment d'URL (alignés sur AppSidebar ITEMS + TABS de tools.tsx).
const PATH_LABELS: Record<string, string> = {
  "/classement": "Classement faction",
  "/polls": "Sondages",
  "/absences": "Absences",
  "/tools": "Outils Paladium",
  "/tools/alerts": "Mes alertes",
  "/tools/player": "Player",
  "/tools/sales": "Ventes",
  "/tools/faction": "Faction",
  "/tools/status": "Status",
  "/tools/market": "Market",
  "/tools/leaderboard": "Leaderboard",
  "/tools/clicker": "Clicker",
  "/tools/xp-calculator": "XP Calc",
  "/tools/events": "Events",
  "/tools/uptime": "Uptime",
  "/tools/shop-admin": "Shop admin",
  "/staff": "Dashboard staff",
  "/members": "Membres",
  "/effectif": "Effectif",
  "/pdc": "Plan de coupe",
  "/recruitment": "Candidatures",
  "/blacklist": "Blacklist",
  "/points": "Gestion Points",
  "/config": "Config valeurs",
  "/logs": "Logs",
  "/admin": "Admin",
  "/welcome": "Bienvenue",
};

function buildCrumbs(pathname: string): Array<{ label: string; href: string; isLast: boolean }> {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string; isLast: boolean }> = [];
  for (let i = 0; i < segments.length; i++) {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = PATH_LABELS[href] ?? decodeURIComponent(segments[i]);
    crumbs.push({ label, href, isLast: i === segments.length - 1 });
  }
  return crumbs;
}

function AuthLayout() {
  const loaderUser = Route.useLoaderData();
  const { data: freshUser } = useCurrentUser();
  // loaderUser provient du loader SSR (contexte de requête fiable) ;
  // freshUser est la version rafraîchie côté client. On préfère le frais,
  // mais on retombe sur le loader si le fetch client échoue.
  const user = freshUser ?? loaderUser;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const crumbs = buildCrumbs(pathname);

  const trackView = useServerFn(recordView);
  const lastTrackedRef = useRef<string | null>(null);
  // Tracking discret des vues authentifiées (analytics staff).
  useEffect(() => {
    if (!user) return;
    if (lastTrackedRef.current === pathname) return;
    lastTrackedRef.current = pathname;
    void trackView({ data: { path: pathname } }).catch(() => {});
  }, [pathname, user, trackView]);

  if (!user) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-background text-muted-foreground uppercase tracking-[0.3em] text-xs"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // loading…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground relative">
        {/* Background grid violet */}
        <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(rgba(139,92,246,0.4) 0.5px, transparent 0.5px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <AppSidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-14 flex items-center gap-3 border-b border-border px-4 sticky top-0 bg-background/90 backdrop-blur z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <Breadcrumb className="hidden sm:flex" style={{ fontFamily: "'Space Mono'" }}>
              <BreadcrumbList className="text-[10px] uppercase tracking-[0.3em] gap-1.5 sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-muted-foreground hover:text-primary">
                    <Link to="/me">PunkAstik //</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((c) => (
                  <span key={c.href} className="inline-flex items-center gap-1.5 sm:gap-2">
                    <BreadcrumbSeparator className="text-muted-foreground [&>svg]:size-3" />
                    <BreadcrumbItem>
                      {c.isLast ? (
                        <BreadcrumbPage className="text-foreground font-normal">
                          {c.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={c.href}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {c.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1">
              <CommandPalette />
              <NotificationBell />
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] hidden md:inline ml-1"
                style={{ fontFamily: "'Space Mono'" }}
              >
                SYS_HUB_V2
              </span>
              <span
                className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(52,211,153,0.7)] ml-1"
                aria-hidden
              />
            </div>
          </header>

          <main
            className="flex-1 p-4 md:p-6 overflow-x-hidden relative"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
