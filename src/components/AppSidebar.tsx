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
  Bell,
  Megaphone,
  Eye,
  Award,
  BarChart3,
  Rocket,
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
  useSidebar,
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

type Section = {
  label: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    label: "// punkastik",
    items: [
      {
        title: "Mon profil",
        url: "/me",
        icon: UserCircle2,
        perm: "profile.self",
        accent: "pink",
      },
      {
        title: "Classement",
        url: "/dashboard",
        icon: Trophy,
        perm: "profile.self",
        accent: "blurple",
      },
      {
        title: "Sondages",
        url: "/polls",
        icon: CalendarCheck,
        perm: "profile.self",
        accent: "blurple",
      },
      {
        title: "Effectif",
        url: "/effectif",
        icon: ListTree,
        perm: "profile.self",
        accent: "pink",
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
        title: "Projets",
        url: "/projects",
        icon: Target,
        perm: "profile.self",
        accent: "pink",
      },
      {
        title: "Valeurs & ressources",
        url: "/values",
        icon: Coins,
        perm: "profile.self",
        accent: "blurple",
      },
      {
        title: "Check BC",
        url: "/tools/check-bc",
        icon: ShieldAlert,
        perm: "profile.self",
        accent: "pink",
      },
      {
        title: "Mes alertes",
        url: "/tools/alerts",
        icon: Bell,
        perm: "profile.self",
        accent: "pink",
      },
    ],
  },
  {
    label: "// staff",
    items: [
      {
        title: "Dashboard staff",
        url: "/staff",
        icon: LayoutDashboard,
        perm: "members.view",
        accent: "blurple",
      },
      {
        title: "Récap",
        url: "/staff-recap",
        icon: Eye,
        perm: "members.view",
        accent: "pink",
      },
      {
        title: "Réunion 19 juin · V12",
        url: "/reunion-v12",
        icon: Rocket,
        perm: "members.view",
        accent: "pink",
      },
      {
        title: "Analytics site",
        url: "/staff-analytics",
        icon: BarChart3,
        perm: "members.view",
        accent: "pink",
      },
      { title: "Membres", url: "/members", icon: Users, perm: "members.view", accent: "blurple" },
      {
        title: "Plan de coupe",
        url: "/pdc",
        icon: Grid3x3,
        perm: "members.view",
        accent: "blurple",
      },
      {
        title: "Logistique",
        url: "/logistics",
        icon: Wrench,
        perm: "members.view",
        accent: "blurple",
      },
      {
        title: "Économie faction",
        url: "/faction-economy",
        icon: Coins,
        perm: "members.view",
        accent: "blurple",
      },
    ],
  },
  {
    label: "// recrutement",
    items: [
      {
        title: "Candidatures",
        url: "/recruitment",
        icon: UserPlus,
        perm: "recruit.access",
        accent: "pink",
      },
      { title: "Blacklist", url: "/blacklist", icon: Ban, perm: "recruit.access", accent: "pink" },
      {
        title: "Périodes d'essai",
        url: "/trials",
        icon: CalendarCheck,
        perm: "recruit.access",
        accent: "pink",
      },
      {
        title: "Backlog candidatures",
        url: "/backlog",
        icon: FileText,
        perm: "admin.access",
        accent: "pink",
      },
    ],
  },
  {
    label: "// économie",
    items: [
      {
        title: "Gestion Points",
        url: "/points",
        icon: Coins,
        perm: "points.manage",
        accent: "pink",
      },
      {
        title: "Config valeurs",
        url: "/config",
        icon: Settings2,
        perm: "config.manage",
        accent: "blurple",
      },
    ],
  },
  {
    label: "// administration",
    items: [
      { title: "Logs", url: "/logs", icon: FileText, perm: "admin.access", accent: "blurple" },
      { title: "Admin", url: "/admin", icon: ShieldAlert, perm: "admin.access", accent: "pink" },
    ],
  },
];

export function AppSidebar({ user }: { user: CurrentUser | null | undefined }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => hasPerm(user, i.perm)),
  })).filter((section) => section.items.length > 0);

  const handleNavClick = () => {
    setOpenMobile(false);
  };

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
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel
              className="text-[9px] text-zinc-600 uppercase tracking-[0.3em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
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
                        <Link
                          to={item.url}
                          className="flex items-center gap-3"
                          onClick={handleNavClick}
                        >
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
        ))}
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
