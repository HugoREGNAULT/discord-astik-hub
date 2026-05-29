import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, ChevronDown, Clock, ExternalLink } from "lucide-react";
import { listRecentCarts } from "@/lib/data/donations.functions";
import { EmptyState } from "@/components/EmptyState";

type Line = {
  id: string;
  label: string;
  line_type: string;
  unit_points: number;
  quantity: number;
  subtotal: number;
};

type Cart = {
  id: string;
  status: string;
  member_discord_id: string | null;
  staff_username: string | null;
  staff_discord_id: string;
  bonus_pct: number;
  total_brut: number;
  total_final: number;
  created_at: string;
  expires_at: string;
  validated_at: string | null;
  cancelled_at: string | null;
  donation_lines: Line[];
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-primary/15 text-primary border-primary/30",
    validated: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const labels: Record<string, string> = {
    active: "Actif",
    validated: "Validé",
    expired: "Expiré",
    cancelled: "Annulé",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {labels[status] ?? status}
    </Badge>
  );
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatRemaining(expiresAt: string, now: number) {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "Expiré";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

export function RecentCartsPanel() {
  const fetchFn = useServerFn(listRecentCarts);
  const { data, isLoading } = useQuery({
    queryKey: ["recent-carts"],
    queryFn: () => fetchFn({ data: { limit: 10 } }),
    refetchInterval: 30_000,
  });
  const now = useNow(1000);

  const carts = (data?.carts ?? []) as Cart[];
  const members = data?.members ?? {};

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="size-5 text-primary" />
          Derniers paniers de dons
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/donations">
            Voir tout <ExternalLink className="size-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : carts.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Aucun panier récent"
            description="Les paniers de dons apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-border">
            {carts.map((c) => {
              const m = c.member_discord_id ? members[c.member_discord_id] : null;
              const displayName =
                m?.ig_name ?? m?.discord_username ?? c.member_discord_id ?? "— non assigné —";
              const isActive = c.status === "active";
              return (
                <li key={c.id} className="py-3">
                  <Collapsible>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Avatar className="size-8">
                        <AvatarImage src={m?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(m?.ig_name ?? m?.discord_username ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{displayName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          par {c.staff_username ?? c.staff_discord_id} ·{" "}
                          {new Date(c.created_at).toLocaleString("fr-FR")}
                        </div>
                      </div>
                      {statusBadge(c.status)}
                      {isActive && (
                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatRemaining(c.expires_at, now)}
                        </span>
                      )}
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">
                          {c.total_final.toLocaleString("fr-FR")} pts
                        </div>
                        {c.bonus_pct > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            base {c.total_brut.toLocaleString("fr-FR")} +{c.bonus_pct}%
                          </div>
                        )}
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="px-2">
                          <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-2">
                      {c.donation_lines.length === 0 ? (
                        <div className="text-xs text-muted-foreground pl-11">
                          Aucune ligne dans ce panier.
                        </div>
                      ) : (
                        <ul className="pl-11 space-y-1 text-xs">
                          {c.donation_lines.map((l) => (
                            <li
                              key={l.id}
                              className="flex items-center gap-2 border-l-2 border-border pl-2"
                            >
                              <Badge variant="secondary" className="text-[9px] uppercase">
                                {l.line_type}
                              </Badge>
                              <span className="flex-1 truncate">{l.label}</span>
                              <span className="font-mono text-muted-foreground">
                                {l.quantity} × {l.unit_points}
                              </span>
                              <span className="font-mono font-semibold w-16 text-right">
                                {l.subtotal.toLocaleString("fr-FR")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
