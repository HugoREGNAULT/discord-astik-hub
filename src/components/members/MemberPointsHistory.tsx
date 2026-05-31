import { ChevronDown, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import type { MemberPointsEntry } from "./types";

interface Props {
  items: MemberPointsEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

export function MemberPointsHistory({ items, hasMore, onLoadMore, isLoadingMore }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Coins className="size-4 text-primary" /> Historique points
          </span>
          <Badge variant="outline">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Coins}
              title="Aucun mouvement"
              description="L'historique de points apparaîtra ici."
              variant="compact"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {items.map((p) => (
              <li key={p.id} className="px-4 py-2 text-sm flex items-center gap-3">
                <span
                  className={`font-mono font-semibold w-16 text-right ${
                    p.amount >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {p.amount >= 0 ? "+" : ""}
                  {p.amount}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    {p.action_type}
                    {p.reason ? ` · ${p.reason}` : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Par {p.staff_username ?? p.staff_discord_id} ·{" "}
                    {new Date(p.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">→ {p.total_after}</span>
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
