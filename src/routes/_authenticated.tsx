import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated")({
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

function AuthLayout() {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();

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
              backgroundImage:
                "radial-gradient(#5865F2 0.5px, transparent 0.5px)",
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
            <div
              className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // punkastik / hub
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <CommandPalette />
              <NotificationBell />
              <span
                className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] hidden sm:inline ml-1"
                style={{ fontFamily: "'Space Mono'" }}
              >
                SYS_HUB_V2
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
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
