/**
 * useRealtimeChannel — abonne le composant à un canal Postgres-changes Supabase
 * et invalide les queryKeys passées à chaque event reçu.
 *
 * Le client n'utilise ce push QUE pour invalider son cache TanStack Query.
 * Le détail sensible reste servi par les server functions gatées.
 */
import { useEffect } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import type {
  RealtimePostgresChangesPayload,
  REALTIME_LISTEN_TYPES,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export function useRealtimeChannel(
  table: string,
  event: PostgresEvent = "*",
  queryKeys: QueryKey[] = [],
): void {
  const queryClient = useQueryClient();

  // Stringifie les querykeys pour stabiliser les dépendances de l'effet.
  const keysKey = JSON.stringify(queryKeys);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = JSON.parse(keysKey) as QueryKey[];
    const channelName = `rt:${table}:${event}:${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        // typing constant from supabase-js
        "postgres_changes" as `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
        { event, schema: "public", table },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          for (const k of parsed) {
            queryClient.invalidateQueries({ queryKey: k });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, event, keysKey, queryClient]);
}
