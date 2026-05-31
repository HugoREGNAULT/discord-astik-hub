/**
 * usePdcCollab — collaboration temps réel pour l'éditeur PDC.
 *
 * Broadcast : éditions de cellules + curseurs (rapide, non persisté).
 * Presence : liste des éditeurs actifs (clé = discordId).
 *
 * La PERSISTANCE reste savePdcPlan (débouncé côté éditeur).
 * Si Realtime est indisponible, le hook dégrade proprement (peers vide,
 * broadcasts no-op) : l'édition mono-utilisateur continue de marcher.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CellEdit = {
  layer: number;
  x: number;
  y: number;
  block_id: string | null;
  /** Émetteur (pour ignorer ses propres echos si jamais self=true ailleurs). */
  from?: string;
  /** Timestamp ms (last-write-wins par cellule). */
  ts: number;
};

export type CursorPos = { x: number; y: number };

export type Peer = {
  discordId: string;
  username: string;
  color: string;
  cursor: CursorPos | null;
};

export type PdcCollabOptions = {
  planId: string | null;
  me: { discordId: string; username: string } | null;
  onRemoteEdit?: (delta: CellEdit) => void;
  /** Désactiver le mode collab (fallback mono-user). */
  enabled?: boolean;
};

type PresenceState = {
  discordId: string;
  username: string;
  color: string;
  cursor: CursorPos | null;
};

const CURSOR_THROTTLE_MS = 50;

/** Couleur stable dérivée du discordId (HSL). */
function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 75% 60%)`;
}

export function usePdcCollab(opts: PdcCollabOptions): {
  peers: Peer[];
  connected: boolean;
  broadcastCellEdit: (edit: Omit<CellEdit, "ts" | "from">) => void;
  broadcastCursor: (pos: CursorPos) => void;
} {
  const { planId, me, onRemoteEdit, enabled = true } = opts;

  const [peers, setPeers] = useState<Peer[]>([]);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRemoteEditRef = useRef(onRemoteEdit);
  onRemoteEditRef.current = onRemoteEdit;

  const myColor = useMemo(() => (me ? colorForId(me.discordId) : "#888"), [me]);

  // Cursor throttle
  const lastCursorSentAt = useRef(0);
  const pendingCursor = useRef<CursorPos | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !planId || !me || typeof window === "undefined") {
      return;
    }

    const channel = supabase.channel(`pdc:${planId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: me.discordId },
      },
    });
    channelRef.current = channel;

    const syncPeers = () => {
      const state = channel.presenceState<PresenceState>();
      const list: Peer[] = [];
      for (const key of Object.keys(state)) {
        const metas = state[key];
        if (!metas || metas.length === 0) continue;
        const m = metas[0];
        list.push({
          discordId: m.discordId,
          username: m.username,
          color: m.color,
          cursor: m.cursor ?? null,
        });
      }
      setPeers(list);
    };

    channel
      .on("presence", { event: "sync" }, syncPeers)
      .on("presence", { event: "join" }, syncPeers)
      .on("presence", { event: "leave" }, syncPeers)
      .on("broadcast", { event: "cell" }, (payload) => {
        const d = payload.payload as CellEdit | undefined;
        if (!d) return;
        if (d.from === me.discordId) return;
        onRemoteEditRef.current?.(d);
      })
      .on("broadcast", { event: "cursor" }, (payload) => {
        const d = payload.payload as
          | { from: string; cursor: CursorPos | null }
          | undefined;
        if (!d || d.from === me.discordId) return;
        setPeers((prev) =>
          prev.map((p) => (p.discordId === d.from ? { ...p, cursor: d.cursor } : p)),
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({
            discordId: me.discordId,
            username: me.username,
            color: myColor,
            cursor: null,
          } satisfies PresenceState);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      setConnected(false);
      setPeers([]);
      if (cursorTimer.current) {
        clearTimeout(cursorTimer.current);
        cursorTimer.current = null;
      }
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, planId, me, myColor]);

  const broadcastCellEdit = useCallback(
    (edit: Omit<CellEdit, "ts" | "from">) => {
      const ch = channelRef.current;
      if (!ch || !me) return;
      const payload: CellEdit = { ...edit, from: me.discordId, ts: Date.now() };
      void ch.send({ type: "broadcast", event: "cell", payload });
    },
    [me],
  );

  const sendCursorNow = useCallback(
    (pos: CursorPos | null) => {
      const ch = channelRef.current;
      if (!ch || !me) return;
      void ch.send({
        type: "broadcast",
        event: "cursor",
        payload: { from: me.discordId, cursor: pos },
      });
    },
    [me],
  );

  const broadcastCursor = useCallback(
    (pos: CursorPos) => {
      const now = Date.now();
      const elapsed = now - lastCursorSentAt.current;
      if (elapsed >= CURSOR_THROTTLE_MS) {
        lastCursorSentAt.current = now;
        pendingCursor.current = null;
        sendCursorNow(pos);
        return;
      }
      pendingCursor.current = pos;
      if (cursorTimer.current) return;
      cursorTimer.current = setTimeout(() => {
        cursorTimer.current = null;
        if (pendingCursor.current) {
          lastCursorSentAt.current = Date.now();
          sendCursorNow(pendingCursor.current);
          pendingCursor.current = null;
        }
      }, CURSOR_THROTTLE_MS - elapsed);
    },
    [sendCursorNow],
  );

  return { peers, connected, broadcastCellEdit, broadcastCursor };
}
