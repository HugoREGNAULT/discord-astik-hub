import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Clock } from "lucide-react";
import { getMyListings } from "@/lib/data/me.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Listing = {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  price_pb: number | null;
  listed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  sold_at: string | null;
};

function fmtMoney(n: number) {
  return n.toLocaleString("fr-FR") + " $";
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ListingRow({ r, showSold }: { r: Listing; showSold?: boolean }) {
  const total = r.price * r.quantity;
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="min-w-0">
        <span className="text-sm text-foreground font-medium truncate block">{r.item_name}</span>
        <span className="text-[11px] text-muted-foreground font-mono">
          ×{r.quantity} · {fmtMoney(r.price)}/u
          {showSold && r.sold_at ? (
            <>
              {" "}
              · <span className="text-emerald-400">vendu {fmtDate(r.sold_at)}</span>
            </>
          ) : null}
        </span>
      </div>
      <span className="text-sm font-bold text-primary/70 whitespace-nowrap font-mono shrink-0">
        {fmtMoney(total)}
      </span>
    </div>
  );
}

export function MemberSalesCard() {
  const fetchMyListings = useServerFn(getMyListings);

  const q = useQuery({
    queryKey: ["me-listings"],
    queryFn: () => fetchMyListings(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const open: Listing[] = q.data?.open ?? [];
  const sold: Listing[] = q.data?.recentSold ?? [];
  const lastSync = q.data?.lastSyncedAt ?? null;

  const openValue = open.reduce((acc, r) => acc + r.price * r.quantity, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="w-4 h-4 text-primary" />
          Ventes HDV
        </CardTitle>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          Actualisé {fmtRelative(lastSync)}
          {lastSync && (
            <span className="text-muted-foreground/70">· données BDD, jamais l'API directe</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {q.isLoading && <div className="h-16 animate-pulse rounded bg-secondary/50" />}

        {!q.isLoading && open.length === 0 && sold.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Aucune vente trouvée — le premier sync arrive dans les 5 minutes.
          </p>
        )}

        {open.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span
                className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // en cours ({open.length})
              </span>
              <span className="text-xs text-primary/70 font-mono">{fmtMoney(openValue)}</span>
            </div>
            <div className="max-h-48 overflow-y-auto pr-1">
              {open.map((r) => (
                <ListingRow key={r.id} r={r} />
              ))}
            </div>
          </div>
        )}

        {sold.length > 0 && (
          <div>
            <div className="mb-1.5">
              <span
                className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                style={{ fontFamily: "'Space Mono'" }}
              >
                // vendues récemment ({sold.length})
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto pr-1">
              {sold.map((r) => (
                <ListingRow key={r.id} r={r} showSold />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
