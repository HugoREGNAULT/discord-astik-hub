import { Link, useRouterState } from "@tanstack/react-router";
import {
  Trophy,
  UserCircle2,
  Users,
  Coins,
  ShoppingCart,
  Settings2,
  ListTree,
  Target,
  ShieldAlert,
  LogOut,
  UserPlus,
  CalendarCheck,
  FileText,
  Ban,
  LayoutDashboard,
  Grid3x3,
  Wrench,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { CurrentUser } from "@/lib/auth/session.functions";
import { hasPerm } from "@/lib/auth/use-current-user";
import type { Permission } from "@/lib/auth/permissions";
import logo from "@/assets/logo.png";

type Item = {
  title: string;
  url: string;
  icon: any;
  perm: Permission;
  accent?: "pink" | "blurple";
};

const ITEMS: Item[] = [
  { title: "Mon profil", url: "/me", icon: UserCircle2, perm: "profile.self", accent: "pink" },
  { title: "Classement", url: "/dashboard", icon: Trophy, perm: "profile.self", accent: "blurple" },
  {
    title: "Sondages",
    url: "/polls",
    icon: CalendarCheck,
    perm: "profile.self",
    accent: "blurple",
  },
  {
    title: "Absences",
    url: "/absences",
    icon: CalendarCheck,
    perm: "profile.self",
    accent: "pink",
  },
  {
    title: "Outils Paladium",
    url: "/tools",
    icon: Wrench,
    perm: "profile.self",
    accent: "blurple",
  },

  {
    title: "Dashboard staff",
    url: "/staff",
    icon: LayoutDashboard,
    perm: "members.view",
    accent: "blurple",
  },
  { title: "Membres", url: "/members", icon: Users, perm: "members.view", accent: "blurple" },

  {
    title: "Candidatures",
    url: "/recruitment",
    icon: UserPlus,
    perm: "recruit.access",
    accent: "pink",
  },
  { title: "Blacklist", url: "/blacklist", icon: Ban, perm: "recruit.access", accent: "pink" },
  { title: "AstikPoints", url: "/points", icon: Coins, perm: "points.manage", accent: "pink" },
  {
    title: "Dons",
    url: "/donations",
    icon: ShoppingCart,
    perm: "donations.manage",
    accent: "pink",
  },
  {
    title: "Config valeurs",
    url: "/config",
    icon: Settings2,
    perm: "config.manage",
    accent: "blurple",
  },
  { title: "Effectif", url: "/effectif", icon: ListTree, perm: "members.view", accent: "blurple" },
  { title: "Objectifs", url: "/objectives", icon: Target, perm: "objectives.edit", accent: "pink" },
  { title: "Plan de coupe", url: "/pdc", icon: Grid3x3, perm: "members.view", accent: "blurple" },
  { title: "Logs", url: "/logs", icon: FileText, perm: "admin.access", accent: "blurple" },
  { title: "Admin", url: "/admin", icon: ShieldAlert, perm: "admin.access", accent: "pink" },
];

export function AppSidebar({ user }: { user: CurrentUser | null | undefined }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = ITEMS.filter((i) => hasPerm(user, i.perm));

  return (
    <Sidebar
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:bg-[#0a0a0c] [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-zinc-800/80 text-white"
    >
      <SidebarHeader className="border-b border-zinc-800/80">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-pink-500/30 blur-md" />
            <img
              src={logo}
              alt="PunkAstik"
              className="relative w-8 h-8 object-cover rounded-sm border border-pink-500/40"
            />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span
              className="text-sm font-bold uppercase tracking-tight text-white"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              PunkAstik <span className="text-pink-500">//</span>
            </span>
            <span
              className="text-[9px] text-zinc-500 uppercase tracking-[0.2em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Faction Paladium
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#0a0a0c]">
        <SidebarGroup>
          <SidebarGroupLabel
            className="text-[9px] text-zinc-600 uppercase tracking-[0.3em]"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                const accentBar = item.accent === "blurple" ? "bg-[#5865F2]" : "bg-pink-500";
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={`relative rounded-none border border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/80 hover:border-zinc-800 data-[active=true]:bg-zinc-900 data-[active=true]:text-white data-[active=true]:border-zinc-800 transition-colors`}
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <span
                          className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] ${accentBar} ${
                            active ? "opacity-100" : "opacity-0 group-hover/menu-item:opacity-60"
                          } transition-opacity`}
                        />
                        <item.icon className="size-4 shrink-0" />
                        <span
                          className="text-xs uppercase tracking-wider"
                          style={{ fontFamily: "'Space Grotesk'" }}
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-[#0a0a0c] border-t border-zinc-800/80">
        {user && (
          <div className="flex items-center gap-2 px-2 py-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-8 rounded-sm border border-zinc-700"
              />
            ) : (
              <div className="size-8 rounded-sm bg-zinc-800 border border-zinc-700" />
            )}
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <div
                className="text-xs font-bold truncate uppercase tracking-tight text-white"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {user.globalName ?? user.username}
              </div>
              <div
                className="text-[9px] text-zinc-500 truncate uppercase tracking-[0.2em]"
                style={{ fontFamily: "'Space Mono'" }}
              >
                @{user.username}
              </div>
            </div>
            <a
              href="/api/auth/logout"
              className="text-zinc-500 hover:text-pink-500 group-data-[collapsible=icon]:hidden transition-colors"
              title="Déconnexion"
            >
              <LogOut className="size-4" />
            </a>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
