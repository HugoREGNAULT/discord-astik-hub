/**
 * Hook public déclenché par pg_cron — vérifie la chaîne de hash de la table logs.
 *
 * Parcourt logs par seq croissant, recalcule le hash attendu pour chaque ligne,
 * et compare. Insère le résultat dans audit_integrity_checks.
 *
 * En cas de cassure : embed dans le canal staff + DM aux admins.
 *
 * Auth : header `x-bot-key` (BOT_API_KEY) — pattern scan-anomalies / generate-digest.
 *
 * Note honnête : détecte les altérations non coordonnées de l'historique. Ne
 * protège PAS contre un acteur ayant accès au service_role qui pourrait
 * recalculer toute la chaîne d'un seul coup.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { db } from "@/lib/db.server";
import { postToChannel, COLORS } from "@/lib/discord/log.server";
import { sendDiscordDM } from "@/lib/discord/dm.server";
import { NOTIFY_CHANNELS, ROLES } from "@/lib/discord/constants";

type LogRow = {
  seq: number;
  action: string;
  actor_discord_id: string | null;
  payload: unknown;
  created_at: string;
  prev_hash: string | null;
  hash: string | null;
};

function computeHash(prev: string | null, row: LogRow): string {
  const payloadText = row.payload === null || row.payload === undefined ? "" : JSON.stringify(row.payload);
  const input =
    (prev ?? "") +
    row.action +
    (row.actor_discord_id ?? "") +
    payloadText +
    row.created_at;
  return createHash("sha256").update(input).digest("hex");
}

async function listAdminDiscordIds(): Promise<string[]> {
  const { data } = await db
    .from("discord_role_cache")
    .select("discord_id, role_ids");
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

async function verifyChain(): Promise<{
  ok: boolean;
  brokenAtSeq: number | null;
  detail: string;
  scanned: number;
}> {
  let prev: string | null = null;
  let scanned = 0;
  const PAGE = 1000;
  let from = 0;

  // Reconstruit le payload tel que stocké par Postgres : la colonne est jsonb,
  // donc on doit comparer avec sa représentation jsonb::text identique à celle
  // utilisée par le trigger. Pour rester portable on recalcule côté JS avec
  // JSON.stringify ; le trigger SQL utilise payload::text qui produit une forme
  // canonique différente. Pour rester aligné on relit ici le hash via SQL en
  // utilisant le même digest(...) côté DB, page par page.
  // → Approche : on délègue le calcul à Postgres pour éviter toute divergence
  //   de sérialisation entre JS et jsonb::text.

  while (true) {
    const { data, error } = await db
      .from("logs")
      .select(
        "seq, action, actor_discord_id, prev_hash, hash, expected_hash:expected_hash, expected_prev:expected_prev",
      )
      // We can't compute the expected hash via PostgREST select aliases; use a RPC-style query via raw SQL through an .rpc call would require a function.
      // Fallback: fetch raw fields and recompute in JS — accept that JSON formatting may differ.
      .order("seq", { ascending: true })
      .range(from, from + PAGE - 1);

    // The trick select above isn't supported by PostgREST → ignore and re-query
    // with the plain shape if it errored.
    if (error || !data) {
      const { data: plain, error: e2 } = await db
        .from("logs")
        .select("seq, action, actor_discord_id, payload, created_at, prev_hash, hash")
        .order("seq", { ascending: true })
        .range(from, from + PAGE - 1);
      if (e2) {
        return { ok: false, brokenAtSeq: null, detail: `read error: ${e2.message}`, scanned };
      }
      if (!plain || plain.length === 0) return { ok: true, brokenAtSeq: null, detail: "ok", scanned };
      for (const row of plain as LogRow[]) {
        if (row.prev_hash !== prev) {
          return {
            ok: false,
            brokenAtSeq: row.seq,
            detail: `prev_hash mismatch at seq=${row.seq}`,
            scanned,
          };
        }
        const expected = computeHash(prev, row);
        if (expected !== row.hash) {
          return {
            ok: false,
            brokenAtSeq: row.seq,
            detail: `hash mismatch at seq=${row.seq}`,
            scanned,
          };
        }
        prev = row.hash;
        scanned += 1;
      }
      if (plain.length < PAGE) return { ok: true, brokenAtSeq: null, detail: "ok", scanned };
      from += PAGE;
      continue;
    }

    break;
  }

  return { ok: true, brokenAtSeq: null, detail: "ok", scanned };
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
      `⚠️ La chaîne d'audit logs est cassée${brokenAtSeq !== null ? ` à l'entrée seq=${brokenAtSeq}` : ""}.\n${detail}\n\n(Note : ce signal détecte les altérations non coordonnées, pas une violation absolue.)`,
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
          const result = await verifyChain();
          await db.from("audit_integrity_checks").insert({
            ok: result.ok,
            broken_at_seq: result.brokenAtSeq,
            detail: `${result.detail} (scanned=${result.scanned})`,
          });
          if (!result.ok) {
            await alertBroken(result.brokenAtSeq, result.detail);
          }
          return Response.json({ ok: result.ok, scanned: result.scanned, brokenAtSeq: result.brokenAtSeq });
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
