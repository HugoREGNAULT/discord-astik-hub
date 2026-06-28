import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Coins, AlertTriangle, UserPlus, ShoppingCart, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/data/notifications.functions";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

const iconFor = (k: NotificationItem["kind"]) => {
  switch (k) {
    case "points":
      return Coins;
    case "warning":
      return AlertTriangle;
    case "application":
      return UserPlus;
    case "donation":
      return ShoppingCart;
    default:
      return Sparkles;
  }
};

const colorFor = (k: NotificationItem["kind"]) => {
  switch (k) {
    case "points":
      return "text-primary";
    case "warning":
      return "text-destructive";
    case "application":
      return "text-primary";
    case "donation":
      return "text-primary";
    default:
      return "text-foreground";
  }
};

export function NotificationBell() {
  const fn = useServerFn(getMyNotifications);
  const markAll = useServerFn(markAllNotificationsRead);
  const markOne = useServerFn(markNotificationRead);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  // Realtime : invalide à chaque INSERT/UPDATE sur notifications.
  useRealtimeChannel("notifications", "*", [["notifications"]]);

  const [open, setOpen] = useState(false);
  const items = data?.items ?? [];
  const unread = useMemo(() => items.filter((i) => !i.readAt).length, [items]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && unread > 0) {
          void markAll().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-primary hover:bg-secondary"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground grid place-items-center shadow-[0_0_8px_rgba(139,92,246,0.7)]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-card border-border text-foreground">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span
            className="text-[10px] text-muted-foreground uppercase tracking-[0.3em]"
            style={{ fontFamily: "'Space Mono'" }}
          >
            // notifications
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {items.length}
          </Badge>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">Rien à signaler.</p>
          )}
          <ul className="divide-y divide-border/80">
            {items.map((n) => {
              const Icon = iconFor(n.kind);
              const isUnread = !n.readAt;
              return (
                <li key={n.id}>
                  <Link
                    to={n.href ?? "/me"}
                    onClick={() => {
                      setOpen(false);
                      if (isUnread) {
                        void markOne({ data: { id: n.id } }).then(() =>
                          qc.invalidateQueries({ queryKey: ["notifications"] }),
                        );
                      }
                    }}
                    className={`flex gap-2.5 px-3 py-2.5 hover:bg-secondary/80 transition ${
                      isUnread ? "bg-secondary/40" : ""
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 mt-0.5 ${colorFor(n.kind)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{n.title}</div>
                      {n.detail && (
                        <div className="text-[11px] text-muted-foreground truncate">{n.detail}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
