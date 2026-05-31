/**
 * StaffPresence — affiche les staff en ligne sur la page courante via Supabase
 * Realtime Presence. Chaque membre track {username, avatar, discordId} sous sa
 * propre clé presence (discordId), évitant les doublons multi-onglets.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PresencePayload {
  discordId: string;
  username: string;
  avatar: string | null;
}

interface Props {
  discordId: string;
  username: string;
  avatar: string | null;
  channelName?: string;
}

export function StaffPresence({
  discordId,
  username,
  avatar,
  channelName = "staff-presence",
}: Props) {
  const [online, setOnline] = useState<PresencePayload[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !discordId) return;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: discordId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const flat: PresencePayload[] = [];
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          const entries = state[key];
          if (!entries || entries.length === 0) continue;
          const e = entries[0];
          if (!e?.discordId || seen.has(e.discordId)) continue;
          seen.add(e.discordId);
          flat.push({
            discordId: e.discordId,
            username: e.username,
            avatar: e.avatar ?? null,
          });
        }
        setOnline(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ discordId, username, avatar });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [discordId, username, avatar, channelName]);

  if (online.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {online.length} staff en ligne
        </span>
        <div className="flex -space-x-2">
          {online.slice(0, 8).map((u) => (
            <Tooltip key={u.discordId}>
              <TooltipTrigger asChild>
                <Avatar className="size-7 ring-2 ring-background">
                  {u.avatar ? <AvatarImage src={u.avatar} alt={u.username} /> : null}
                  <AvatarFallback className="text-[10px]">
                    {u.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{u.username}</TooltipContent>
            </Tooltip>
          ))}
          {online.length > 8 ? (
            <span className="ml-3 text-xs text-muted-foreground">
              +{online.length - 8}
            </span>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
