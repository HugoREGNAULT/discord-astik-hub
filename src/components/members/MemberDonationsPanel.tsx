import { ChevronDown, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import type { MemberDonationEntry } from "./types";

interface Props {
  items: MemberDonationEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

export function MemberDonationsPanel({ items, hasMore, onLoadMore, isLoadingMore }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-primary" /> Donations
          </span>
          <Badge variant="outline">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShoppingCart}
              title="Aucune donation"
              description="Les donations valides s'afficheront ici."
              variant="compact"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {items.map((d) => (
              <li key={d.id} className="px-4 py-2 text-sm flex items-center gap-3">
                <Badge
                  variant={
                    d.status === "validated"
                      ? "secondary"
                      : d.status === "active"
                        ? "default"
                        : "outline"
                  }
                >
                  {d.status}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    Brut {d.total_brut} · Bonus {Number(d.bonus_pct ?? 0)}% → final{" "}
                    <span className="font-semibold text-primary">{d.total_final}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.staff_username ?? "?"} · {new Date(d.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasMore && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              <ChevronDown className="size-4 mr-1" />
              {isLoadingMore ? "Chargement…" : "Charger plus"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
