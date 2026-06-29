import { Link, useRouterState } from "@tanstack/react-router";
import {
  UserCircle2,
  Users,
  Coins,
  Settings2,
  ShieldAlert,
  LogOut,
  UserPlus,
  CalendarCheck,
  FileText,
  Ban,
  LayoutDashboard,
  Wrench,
  Bell,
  Trophy,
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
};

type Section = {
  label: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    label: "// punkastik",
    items: [
      { title: "Classement faction", url: "/classement", icon: Trophy, perm: "profile.self" },
      { title: "Mon profil", url: "/me", icon: UserCircle2, perm: "profile.self" },
      { title: "Absences", url: "/absences", icon: CalendarCheck, perm: "profile.self" },
      { title: "Outils Paladium", url: "/tools", icon: Wrench, perm: "profile.self" },
      { title: "Mes alertes", url: "/tools/alerts", icon: Bell, perm: "profile.self" },
    ],
  },
  {
    label: "// staff",
    items: [
      { title: "Dashboard staff", url: "/staff", icon: LayoutDashboard, perm: "members.view" },
      { title: "Membres", url: "/members", icon: Users, perm: "members.view" },
    ],
  },
  {
    label: "// recrutement",
    items: [
      { title: "Candidatures", url: "/recruitment", icon: UserPlus, perm: "recruit.access" },
      { title: "Blacklist", url: "/blacklist", icon: Ban, perm: "recruit.access" },
      { title: "Périodes d'essai", url: "/trials", icon: CalendarCheck, perm: "recruit.access" },
      { title: "Backlog candidatures", url: "/backlog", icon: FileText, perm: "admin.access" },
    ],
  },
  {
    label: "// économie",
    items: [
      { title: "Gestion Points", url: "/points", icon: Coins, perm: "points.manage" },
      { title: "Config valeurs", url: "/config", icon: Settings2, perm: "config.manage" },
    ],
  },
  {
    label: "// administration",
    items: [
      { title: "Logs", url: "/logs", icon: FileText, perm: "admin.access" },
      { title: "Admin", url: "/admin", icon: ShieldAlert, perm: "admin.access" },
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
      className="[&_[data-sidebar=sidebar]]:bg-sidebar [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-sidebar-border text-sidebar-foreground"
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/30 blur-md" />
            <img
              src={logo}
              alt="PunkAstik"
              className="relative w-8 h-8 object-cover rounded-none border border-primary/40"
            />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span
              className="text-sm font-bold uppercase tracking-tight text-sidebar-foreground"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              PunkAstik <span className="text-primary">//</span>
            </span>
            <span
              className="text-[9px] text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Faction Paladium
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel
              className="text-[9px] text-muted-foreground uppercase tracking-[0.3em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="relative rounded-none border border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:border-sidebar-border motion-safe:transition-colors"
                      >
                        <Link
                          to={item.url}
                          className="flex items-center gap-3"
                          onClick={handleNavClick}
                        >
                          <span
                            className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-primary ${
                              active ? "opacity-100" : "opacity-0 group-hover/menu-item:opacity-60"
                            } motion-safe:transition-opacity`}
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

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2 px-2 py-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-8 rounded-none border border-sidebar-border"
              />
            ) : (
              <div className="size-8 rounded-none bg-sidebar-accent border border-sidebar-border" />
            )}
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <div
                className="text-xs font-bold truncate uppercase tracking-tight text-sidebar-foreground"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {user.globalName ?? user.username}
              </div>
              <div
                className="text-[11px] text-muted-foreground truncate uppercase tracking-wide"
                style={{ fontFamily: "'Space Mono'" }}
              >
                @{user.username}
              </div>
            </div>
            <a
              href="/api/auth/logout"
              className="text-muted-foreground hover:text-primary group-data-[collapsible=icon]:hidden motion-safe:transition-colors"
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
