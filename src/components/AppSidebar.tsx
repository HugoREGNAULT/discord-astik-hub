import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  LayoutDashboard,
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

type Item = { title: string; url: string; icon: any; perm: Permission };

const ITEMS: Item[] = [
  { title: "Mon espace", url: "/me", icon: Home, perm: "profile.self" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, perm: "profile.self" },
  { title: "Mon profil", url: "/profile", icon: UserCircle2, perm: "profile.self" },
  { title: "Membres", url: "/members", icon: Users, perm: "members.view" },
  { title: "Candidatures", url: "/recruitment", icon: UserPlus, perm: "recruit.access" },
  { title: "AstikPoints", url: "/points", icon: Coins, perm: "points.manage" },
  { title: "Dons", url: "/donations", icon: ShoppingCart, perm: "donations.manage" },
  { title: "Config valeurs", url: "/config", icon: Settings2, perm: "config.manage" },
  { title: "Effectif", url: "/effectif", icon: ListTree, perm: "members.view" },
  { title: "Objectifs", url: "/objectives", icon: Target, perm: "objectives.edit" },
  { title: "Admin", url: "/admin", icon: ShieldAlert, perm: "admin.access" },
];


export function AppSidebar({ user }: { user: CurrentUser | null | undefined }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = ITEMS.filter((i) => hasPerm(user, i.perm));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="size-8 rounded-md bg-gradient-to-br from-primary to-accent grid place-items-center font-bold text-primary-foreground">
            P
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-wide">PunkAstik</span>
            <span className="text-xs text-muted-foreground">Paladium</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <div className="flex items-center gap-2 px-2 py-2">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="size-8 rounded-full" />
            ) : (
              <div className="size-8 rounded-full bg-muted" />
            )}
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="text-xs font-medium truncate">{user.globalName ?? user.username}</div>
              <div className="text-[10px] text-muted-foreground truncate">@{user.username}</div>
            </div>
            <a
              href="/api/auth/logout"
              className="text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
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
