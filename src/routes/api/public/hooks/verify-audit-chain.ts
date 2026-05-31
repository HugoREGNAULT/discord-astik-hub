/**
 * Hook public déclenché par pg_cron — vérifie la chaîne de hash de la table logs.
 *
 * Appelle public.verify_logs_chain() côté Postgres (qui recompute avec la même
 * formule que le trigger d'insertion → pas de divergence de sérialisation).
 * Insère le résultat dans audit_integrity_checks ; en cas de cassure, prévient
 * le canal staff + DM aux admins.
 *
 * Auth : header `x-bot-key` (BOT_API_KEY) — pattern scan-anomalies.
 *
 * Note honnête : détecte les altérations non coordonnées (édition accidentelle,
 * outil tiers, fuite). Ne protège PAS contre un acteur disposant de
 * service_role qui peut recalculer toute la chaîne d'un coup.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { db } from "@/lib/db.server";
import { postToChannel, COLORS } from "@/lib/discord/log.server";
import { sendDiscordDM } from "@/lib/discord/dm.server";
import { NOTIFY_CHANNELS, ROLES } from "@/lib/discord/constants";

type VerifyRow = {
  ok: boolean;
  broken_at_seq: number | null;
  scanned: number;
  detail: string;
};

async function listAdminDiscordIds(): Promise<string[]> {
  const { data } = await db.from("discord_role_cache").select("discord_id, role_ids");
  if (!data) return [];
  const ids = new Set<string>();
  for (const row of data) {
    const roles = (row.role_ids ?? []) as string[];
    if (roles.includes(ROLES.STAFF_FACTION) || roles.includes(ROLES.HIGH_STAFF_PUBLIC)) {
      ids.add(row.discord_id);
    }
  }
  return [...ids];
}

async function alertBroken(brokenAtSeq: number | null, detail: string): Promise<void> {
  const description = [
    "**Chaîne d'audit logs cassée**",
    brokenAtSeq !== null ? `Entrée fautive : \`seq=${brokenAtSeq}\`` : null,
    `Détail : ${detail}`,
    "",
    "_Limite connue : `service_role` peut recalculer toute la chaîne. Ce signal " +
      "détecte les altérations non coordonnées, pas une violation absolue._",
  ]
    .filter(Boolean)
    .join("\n");

  if (NOTIFY_CHANNELS.STAFF) {
    await postToChannel(NOTIFY_CHANNELS.STAFF, {
      embeds: [
        {
          title: "⚠️ Audit log — intégrité",
          description,
          color: COLORS.danger,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  const admins = await listAdminDiscordIds();
  for (const id of admins) {
    await sendDiscordDM(
      id,
      `⚠️ La chaîne d'audit logs est cassée${brokenAtSeq !== null ? ` à l'entrée seq=${brokenAtSeq}` : ""}.\n${detail}\n\n(Ce signal détecte les altérations non coordonnées, pas une violation absolue.)`,
    );
  }
}

export const Route = createFileRoute("/api/public/hooks/verify-audit-chain")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          // db is the admin client (service_role) → can call SECURITY DEFINER fn.
          const { data, error } = await db.rpc("verify_logs_chain");
          if (error) {
            console.error("verify-audit-chain rpc error", error);
            return new Response(
              JSON.stringify({ ok: false, error: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          const row = (Array.isArray(data) ? data[0] : data) as VerifyRow | undefined;
          const ok = row?.ok ?? false;
          const brokenAtSeq = row?.broken_at_seq ?? null;
          const scanned = Number(row?.scanned ?? 0);
          const detail = `${row?.detail ?? "no result"} (scanned=${scanned})`;

          await db.from("audit_integrity_checks").insert({
            ok,
            broken_at_seq: brokenAtSeq,
            detail,
          });

          if (!ok) await alertBroken(brokenAtSeq, detail);

          return Response.json({ ok, scanned, brokenAtSeq });
        } catch (err) {
          console.error("verify-audit-chain failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
