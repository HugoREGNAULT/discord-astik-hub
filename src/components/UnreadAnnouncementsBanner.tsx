import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, ArrowRight } from "lucide-react";
import { getUnreadAnnouncementsCount } from "@/lib/data/announcements.functions";

export function UnreadAnnouncementsBanner() {
  const fn = useServerFn(getUnreadAnnouncementsCount);
  const { data } = useQuery({
    queryKey: ["announcements", "unread-count"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  const count = data?.count ?? 0;
  if (count <= 0) return null;
  return (
    <Link
      to="/announcements"
      className="flex items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm hover:bg-amber-500/20 transition-colors"
    >
      <span className="flex items-center gap-2 text-amber-200">
        <Megaphone className="size-4" />
        <strong>{count}</strong> annonce{count > 1 ? "s" : ""} non lue
        {count > 1 ? "s" : ""}
      </span>
      <ArrowRight className="size-4 text-amber-300" />
    </Link>
  );
}
