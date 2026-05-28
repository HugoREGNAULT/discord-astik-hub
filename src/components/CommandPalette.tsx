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
  X,
} from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/data/search.functions";
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

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const iconFor = (k: SearchHit["kind"]) => {
  switch (k) {
    case "member":
      return Users;
    case "application":
      return UserPlus;
    case "donation":
      return ShoppingCart;
    case "points":
      return Coins;
  }
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SearchHit["kind"] | null>(null);
  const debounced = useDebounced(q, 220);
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();

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

  const searchFn = useServerFn(globalSearch);
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced, filter],
    queryFn: () => searchFn({ data: { q: debounced, filter: filter ?? undefined } }),
    enabled: open && debounced.trim().length >= 1,
    staleTime: 15_000,
  });

  const hits = data?.hits ?? [];
  const navs = NAVS.filter((n) => hasPerm(user, n.perm));

  const groups = {
    member: hits.filter((h) => h.kind === "member"),
    application: hits.filter((h) => h.kind === "application"),
    donation: hits.filter((h) => h.kind === "donation"),
    points: hits.filter((h) => h.kind === "points"),
  };

  const go = (to: string, params?: any) => {
    setOpen(false);
    setQ("");
    navigate({ to, params });
  };

  const renderGroup = (heading: string, items: SearchHit[]) => {
    if (items.length === 0) return null;
    return (
      <>
        <CommandGroup heading={heading}>
          {items.map((h) => {
            const Icon = iconFor(h.kind);
            const params =
              h.kind === "member" || h.kind === "donation" || h.kind === "points"
                ? (h as { params: { id: string } }).params
                : undefined;
            return (
              <CommandItem
                key={`${h.kind}-${h.id}`}
                value={`${h.kind} ${h.label} ${h.sub ?? ""} ${h.id}`}
                onSelect={() => go(h.to, params)}
              >
                {h.kind === "member" && h.avatarUrl ? (
                  <img src={h.avatarUrl} alt="" className="size-5 rounded-full mr-2" />
                ) : (
                  <Icon className="size-4 mr-2 opacity-60" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{h.label}</div>
                  {h.sub && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {h.sub}
                    </div>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
      </>
    );
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
          placeholder="Rechercher membres, dons, candidatures, points…"
          value={q}
          onValueChange={setQ}
        />
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border/40">
          {([
            { key: "member" as const, label: "Membres", icon: Users, perm: "members.view" as Permission },
            { key: "application" as const, label: "Candidatures", icon: UserPlus, perm: "recruit.access" as Permission },
            { key: "donation" as const, label: "Dons", icon: ShoppingCart, perm: "donations.manage" as Permission },
            { key: "points" as const, label: "AstikPoints", icon: Coins, perm: null },
          ] as { key: SearchHit["kind"]; label: string; icon: any; perm: Permission | null }[])
            .filter((f) => f.perm === null || hasPerm(user, f.perm))
            .map((f) => {
              const active = filter === f.key;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(active ? null : f.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  <Icon className="size-3" />
                  {f.label}
                  {active && <X className="size-3 ml-0.5" />}
                </button>
              );
            })}
        </div>
        <CommandList>
          <CommandEmpty>
            {isFetching
              ? "Recherche…"
              : q.length === 0
                ? "Tape pour rechercher."
                : "Aucun résultat."}
          </CommandEmpty>

          {renderGroup("Membres", groups.member)}
          {renderGroup("Candidatures", groups.application)}
          {renderGroup("Dons", groups.donation)}
          {renderGroup("AstikPoints", groups.points)}

          {!filter && (
            <CommandGroup heading="Navigation">
              {navs.map((n) => (
                <CommandItem
                  key={n.to}
                  value={`nav ${n.label}`}
                  onSelect={() => go(n.to)}
                >
                  <n.icon className="size-4 mr-2 opacity-70" />
                  {n.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
