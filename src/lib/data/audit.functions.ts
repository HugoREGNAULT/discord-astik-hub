/**
 * Lectures pour la page admin d'audit (intégrité + actions sensibles).
 * Server-fn gardée par admin.access. Aucune écriture côté client.
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";

export type IntegrityCheck = {
  id: string;
  checked_at: string;
  ok: boolean;
  broken_at_seq: number | null;
  detail: string | null;
};

export type SensitiveLog = {
  id: string;
  seq: number;
  created_at: string;
  action: string;
  actor_discord_id: string | null;
  level: string;
  payload: Json | null;
};

const SENSITIVE_ACTIONS = [
  "member_delete",
  "permission_change",
  "permission_denied",
  "points_remove",
  "application_reject",
  "warning_create",
  "donation_cancel",
  "config_value_delete",
  "blacklist_add",
];

export const getAuditOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("admin.access");

  const [{ data: lastCheck }, { data: recentSensitive }] = await Promise.all([
    db
      .from("audit_integrity_checks")
      .select("id, checked_at, ok, broken_at_seq, detail")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("logs")
      .select("id, seq, created_at, action, actor_discord_id, level, payload")
      .in("action", SENSITIVE_ACTIONS)
      .order("seq", { ascending: false })
      .limit(50),
  ]);

  return {
    lastCheck: (lastCheck ?? null) as IntegrityCheck | null,
    sensitive: (recentSensitive ?? []) as SensitiveLog[],
  };
});
