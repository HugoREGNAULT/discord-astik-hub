/**
 * /api/staff/members/$id/warnings
 *
 * GET    → liste les avertissements d'un membre (requiert `warnings.view`)
 * POST   → crée un avertissement (requiert `warnings.write`)
 *          body: { body, severity?, category?, expiresInDays? }
 * DELETE → révoque un avertissement (requiert `warnings.write`)
 *          query/body: { id, reason }
 *
 * Authentification via cookie de session Discord. Audit log automatique
 * (`warning_add` / `warning_revoke`) avec acteur staff, cible, et détails.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { AppError } from "@/lib/errors";

const ID_RE = /^\d{5,32}$/;

const SEVERITY_POINTS: Record<string, number> = {
  verbal: 0,
  minor: 1,
  major: 3,
  severe: 5,
};

const createSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  severity: z.enum(["verbal", "minor", "major", "severe"]).default("minor"),
  category: z.string().trim().max(64).optional(),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

const revokeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
});

function bad(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

async function guard(perm: "warnings.view" | "warnings.write") {
  try {
    const user = await requirePermission(perm);
    return { user };
  } catch (e) {
    if (e instanceof AppError) return { error: bad(e.httpStatus ?? 403, e.message) };
    return { error: bad(500, (e as Error).message) };
  }
}

export const Route = createFileRoute("/api/staff/members/$id/warnings")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!ID_RE.test(params.id)) return bad(400, "Invalid member id");
        const g = await guard("warnings.view");
        if ("error" in g) return g.error;
        const { data, error } = await db
          .from("warnings")
          .select("*")
          .eq("member_discord_id", params.id)
          .order("created_at", { ascending: false });
        if (error) return bad(500, error.message);
        return Response.json({ warnings: data ?? [] });
      },
      POST: async ({ params, request }) => {
        if (!ID_RE.test(params.id)) return bad(400, "Invalid member id");
        const g = await guard("warnings.write");
        if ("error" in g) return g.error;

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return bad(400, "Invalid JSON");
        }
        const parsed = createSchema.safeParse(raw);
        if (!parsed.success) return bad(400, parsed.error.message);

        const points = SEVERITY_POINTS[parsed.data.severity] ?? 1;
        const expires_at = parsed.data.expiresInDays
          ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
          : null;

        const { data: inserted, error } = await db
          .from("warnings")
          .insert({
            member_discord_id: params.id,
            staff_discord_id: g.user.discordId,
            staff_username: g.user.username,
            body: parsed.data.body,
            severity: parsed.data.severity,
            category: parsed.data.category ?? null,
            points,
            expires_at,
            status: "active",
          })
          .select("*")
          .single();
        if (error) return bad(500, error.message);

        await logAction("warning_add", g.user.discordId, {
          target: params.id,
          id: inserted.id,
          severity: parsed.data.severity,
          category: parsed.data.category,
          via: "api",
        });

        // Pas de DM au membre pour les avertissements (décision staff).

        return Response.json({ warning: inserted }, { status: 201 });
      },
      DELETE: async ({ params, request }) => {
        if (!ID_RE.test(params.id)) return bad(400, "Invalid member id");
        const g = await guard("warnings.write");
        if ("error" in g) return g.error;

        const url = new URL(request.url);
        let payload: { id?: string; reason?: string } = {
          id: url.searchParams.get("id") ?? undefined,
          reason: url.searchParams.get("reason") ?? undefined,
        };
        if (!payload.id || !payload.reason) {
          try {
            payload = { ...payload, ...((await request.json()) as typeof payload) };
          } catch {
            /* ignore */
          }
        }
        const parsed = revokeSchema.safeParse(payload);
        if (!parsed.success) return bad(400, parsed.error.message);

        const { data: existing, error: gErr } = await db
          .from("warnings")
          .select("id, member_discord_id, body")
          .eq("id", parsed.data.id)
          .maybeSingle();
        if (gErr) return bad(500, gErr.message);
        if (!existing) return bad(404, "Warning not found");
        if (existing.member_discord_id !== params.id) return bad(404, "Warning not found");

        const { error } = await db
          .from("warnings")
          .update({
            status: "revoked",
            revoked_by_discord_id: g.user.discordId,
            revoked_reason: parsed.data.reason,
          })
          .eq("id", parsed.data.id);
        if (error) return bad(500, error.message);

        await logAction("warning_revoke", g.user.discordId, {
          target: params.id,
          id: parsed.data.id,
          reason: parsed.data.reason,
          via: "api",
        });

        void (async () => {
          try {
            const { sendDiscordDM } = await import("@/lib/discord/dm.server");
            await sendDiscordDM(
              params.id,
              `✅ **Avertissement annulé** : ${existing.body}\nMotif : ${parsed.data.reason}`,
            );
          } catch {
            /* best-effort */
          }
        })();

        return Response.json({ ok: true });
      },
    },
  },
});
