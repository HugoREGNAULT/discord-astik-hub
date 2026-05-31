import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getSessionStatus } from "@/lib/auth/session.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { authenticated } = await getSessionStatus();
    if (!authenticated) throw redirect({ to: "/login" });
  },
  head: () => ({
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&family=Space+Mono&display=swap",
      },
    ],
  }),
  component: AuthLayout,
});

// Libellés lisibles par segment d'URL (alignés sur AppSidebar ITEMS + TABS de tools.tsx).
const PATH_LABELS: Record<string, string> = {
  "/me": "Mon profil",
  "/dashboard": "Classement",
  "/polls": "Sondages",
  "/absences": "Absences",
  "/tools": "Outils Paladium",
  "/tools/alerts": "Mes alertes",
  "/tools/player": "Player",
  "/tools/sales": "Ventes",
  "/tools/faction": "Faction",
  "/tools/check-bc": "Check BC",
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
  "/objectives": "Objectifs",
  "/pdc": "Plan de coupe",
  "/recruitment": "Candidatures",
  "/blacklist": "Blacklist",
  "/points": "AstikPoints",
  "/donations": "Dons",
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
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const crumbs = buildCrumbs(pathname);

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/login" });
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-[#0a0a0c] text-zinc-500 uppercase tracking-[0.3em] text-xs"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // loading…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#0a0a0c] text-white relative">
        {/* Background grid */}
        <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(#5865F2 0.5px, transparent 0.5px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent blur-sm" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#5865F2] to-transparent blur-sm" />
        </div>

        <AppSidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-14 flex items-center gap-3 border-b border-zinc-800/80 px-4 sticky top-0 bg-[#0a0a0c]/90 backdrop-blur z-10">
            <SidebarTrigger className="text-zinc-400 hover:text-pink-500" />
            <Breadcrumb
              className="hidden sm:flex"
              style={{ fontFamily: "'Space Mono'" }}
            >
              <BreadcrumbList className="text-[10px] uppercase tracking-[0.3em] gap-1.5 sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-zinc-500 hover:text-pink-500">
                    <Link to="/me">PunkAstik //</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((c) => (
                  <span key={c.href} className="inline-flex items-center gap-1.5 sm:gap-2">
                    <BreadcrumbSeparator className="text-zinc-600 [&>svg]:size-3" />
                    <BreadcrumbItem>
                      {c.isLast ? (
                        <BreadcrumbPage className="text-zinc-300 font-normal">
                          {c.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild className="text-zinc-500 hover:text-pink-500">
                          <Link to={c.href}>{c.label}</Link>
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
              <ThemeToggle />
              <span
                className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] hidden md:inline ml-1"
                style={{ fontFamily: "'Space Mono'" }}
              >
                SYS_HUB_V2
              </span>
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] ml-1"
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
