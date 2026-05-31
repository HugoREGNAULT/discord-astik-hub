import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  User as UserIcon,
  Users,
  Activity,
  ShoppingBag,
  Trophy,
  MousePointerClick,
  Calculator,
  ArrowLeft,
  Receipt,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Outils Paladium · PunkAstik" },
      { name: "description", content: "Outils internes faction PunkAstik pour Paladium." },
    ],
  }),
  component: ToolsLayout,
});

const TABS = [
  { to: "/tools/player", label: "Player", icon: UserIcon },
  { to: "/tools/sales", label: "Ventes", icon: Receipt },
  { to: "/tools/faction", label: "Faction", icon: Users },
  { to: "/tools/check-bc", label: "Check BC", icon: Shield },
  { to: "/tools/status", label: "Status", icon: Activity },
  { to: "/tools/market", label: "Market", icon: ShoppingBag },
  { to: "/tools/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/tools/clicker", label: "Clicker", icon: MousePointerClick },
  { to: "/tools/xp-calculator", label: "XP Calc", icon: Calculator },
] as const;

function ToolsLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/tools"
            className="flex items-center gap-2 text-zinc-400 hover:text-pink-500 text-xs uppercase tracking-[0.3em]"
            style={{ fontFamily: "'Space Mono'" }}
          >
            <ArrowLeft className="w-4 h-4" />
            // outils paladium
          </Link>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800/80 pb-0 -mx-1 px-1">
        {TABS.map((t) => {
          const active = path === t.to || path.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`relative flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.2em] whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-pink-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-white"
              }`}
              style={{ fontFamily: "'Space Mono'" }}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
