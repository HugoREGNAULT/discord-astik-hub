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
      return "text-pink-500";
    case "donation":
      return "text-[#5865F2]";
    default:
      return "text-zinc-300";
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
          className="relative text-zinc-400 hover:text-pink-500 hover:bg-zinc-900"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-pink-500 text-[10px] font-bold text-white grid place-items-center shadow-[0_0_8px_rgba(236,72,153,0.7)]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-[#0a0a0c] border-zinc-800 text-white">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <span
            className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]"
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
            <p className="p-4 text-xs text-zinc-500 text-center">Rien à signaler.</p>
          )}
          <ul className="divide-y divide-zinc-800/80">
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
                    className={`flex gap-2.5 px-3 py-2.5 hover:bg-zinc-900/80 transition ${
                      isUnread ? "bg-zinc-900/40" : ""
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 mt-0.5 ${colorFor(n.kind)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{n.title}</div>
                      {n.detail && (
                        <div className="text-[11px] text-zinc-500 truncate">{n.detail}</div>
                      )}
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {new Date(n.createdAt).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="size-1.5 rounded-full bg-pink-500 mt-1.5 shrink-0" />
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
