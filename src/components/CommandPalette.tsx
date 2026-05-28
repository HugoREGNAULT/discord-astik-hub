import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  UserCircle2,
  Users,
  Coins,
  ShoppingCart,
  Settings2,
  ListTree,
  Target,
  ShieldAlert,
  UserPlus,
  CalendarCheck,
  FileText,
  Search,
} from "lucide-react";
import { listMembers } from "@/lib/data/members.functions";
import { useCurrentUser, hasPerm } from "@/lib/auth/use-current-user";
import type { Permission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

type Nav = { label: string; to: string; icon: any; perm: Permission };

const NAVS: Nav[] = [
  { label: "Mon profil", to: "/me", icon: UserCircle2, perm: "profile.self" },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, perm: "profile.self" },
  { label: "Sondages", to: "/polls", icon: CalendarCheck, perm: "profile.self" },
  { label: "Membres", to: "/members", icon: Users, perm: "members.view" },
  { label: "Candidatures", to: "/recruitment", icon: UserPlus, perm: "recruit.access" },
  { label: "AstikPoints", to: "/points", icon: Coins, perm: "points.manage" },
  { label: "Dons", to: "/donations", icon: ShoppingCart, perm: "donations.manage" },
  { label: "Config valeurs", to: "/config", icon: Settings2, perm: "config.manage" },
  { label: "Effectif", to: "/effectif", icon: ListTree, perm: "members.view" },
  { label: "Objectifs", to: "/objectives", icon: Target, perm: "objectives.edit" },
  { label: "Logs", to: "/logs", icon: FileText, perm: "admin.access" },
  { label: "Admin", to: "/admin", icon: ShieldAlert, perm: "admin.access" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();

  // Raccourci global Cmd/Ctrl + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const canSearchMembers = hasPerm(user, "members.view");
  const membersFn = useServerFn(listMembers);
  const { data: membersData } = useQuery({
    queryKey: ["palette-members", q],
    queryFn: () => membersFn({ data: { q, status: "all" } }),
    enabled: open && canSearchMembers && q.length >= 1,
    staleTime: 30_000,
  });

  const navs = NAVS.filter((n) => hasPerm(user, n.perm));
  const members = (membersData?.members ?? []).slice(0, 8);

  const go = (to: string, params?: any) => {
    setOpen(false);
    setQ("");
    navigate({ to, params });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-zinc-400 hover:text-pink-500 hover:bg-zinc-900 hidden md:inline-flex gap-2 h-8 px-2 text-[10px] uppercase tracking-[0.2em]"
        style={{ fontFamily: "'Space Mono'" }}
        aria-label="Recherche globale"
      >
        <Search className="size-3.5" />
        <span>chercher</span>
        <kbd className="ml-1 hidden lg:inline px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-500 text-[9px]">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden text-zinc-400 hover:text-pink-500 hover:bg-zinc-900"
        aria-label="Recherche"
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher membres, pages…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>

          {canSearchMembers && members.length > 0 && (
            <>
              <CommandGroup heading="Membres">
                {members.map((m) => (
                  <CommandItem
                    key={m.discord_id}
                    value={`${m.ig_name ?? ""} ${m.discord_username ?? ""} ${m.discord_id}`}
                    onSelect={() => go("/members/$id", { id: m.discord_id })}
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="size-5 rounded-full mr-2" />
                    ) : (
                      <Users className="size-4 mr-2 opacity-50" />
                    )}
                    <span>{m.ig_name ?? m.discord_username ?? m.discord_id}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {m.current_grade ?? "—"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigation">
            {navs.map((n) => (
              <CommandItem
                key={n.to}
                value={n.label}
                onSelect={() => go(n.to)}
              >
                <n.icon className="size-4 mr-2 opacity-70" />
                {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
