/**
 * /api/staff/members/$id/notes
 *
 * GET    → liste les notes internes staff d'un membre
 * POST   → ajoute une note (body: string) — requiert `notes.write`
 * DELETE → supprime une note (body: { id: string }) — requiert `notes.write`
 *
 * Toutes les opérations s'authentifient via le cookie de session (Discord),
 * vérifient la permission `notes.view`/`notes.write`, et écrivent un audit log
 * dans `public.logs` (chaîne de hash).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { AppError, ERROR_MESSAGES } from "@/lib/errors";

const ID_RE = /^\d{5,32}$/;

function bad(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

async function guard(perm: "notes.view" | "notes.write") {
  try {
    const user = await requirePermission(perm);
    return { user };
  } catch (e) {
    const err = e as AppError | Error;
    if (err instanceof AppError) {
      return { error: bad(err.httpStatus ?? 403, err.message) };
    }
    return { error: bad(500, (err as Error).message) };
  }
}

export const Route = createFileRoute("/api/staff/members/$id/notes")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!ID_RE.test(params.id)) return bad(400, "Invalid member id");
        const g = await guard("notes.view");
        if ("error" in g) return g.error;
        const { data, error } = await db
          .from("notes")
          .select("id, member_discord_id, body, staff_discord_id, staff_username, created_at")
          .eq("member_discord_id", params.id)
          .order("created_at", { ascending: false });
        if (error) return bad(500, error.message);
        return Response.json({ notes: data ?? [] });
      },
      POST: async ({ params, request }) => {
        if (!ID_RE.test(params.id)) return bad(400, "Invalid member id");
        const g = await guard("notes.write");
        if ("error" in g) return g.error;

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return bad(400, "Invalid JSON");
        }
        const parsed = z
          .object({ body: z.string().trim().min(1).max(2000) })
          .safeParse(raw);
        if (!parsed.success) return bad(400, parsed.error.message);

        const { data: inserted, error } = await db
          .from("notes")
          .insert({
            member_discord_id: params.id,
            staff_discord_id: g.user.discordId,
            staff_username: g.user.username,
            body: parsed.data.body,
          })
          .select("id, member_discord_id, body, staff_discord_id, staff_username, created_at")
          .single();
        if (error) return bad(500, error.message);

        await logAction("note_add", g.user.discordId, {
          target: params.id,
          id: inserted.id,
          via: "api",
        });
        return Response.json({ note: inserted }, { status: 201 });
      },
      DELETE: async ({ params, request }) => {
        if (!ID_RE.test(params.id)) return bad(400, "Invalid member id");
        const g = await guard("notes.write");
        if ("error" in g) return g.error;

        const url = new URL(request.url);
        let noteId = url.searchParams.get("noteId") ?? "";
        if (!noteId) {
          try {
            const raw = (await request.json()) as { id?: string };
            noteId = raw?.id ?? "";
          } catch {
            return bad(400, "Missing note id");
          }
        }
        const parsed = z.string().uuid().safeParse(noteId);
        if (!parsed.success) return bad(400, "Invalid note id");

        const { data: existing, error: gErr } = await db
          .from("notes")
          .select("id, member_discord_id")
          .eq("id", parsed.data)
          .maybeSingle();
        if (gErr) return bad(500, gErr.message);
        if (!existing) return bad(404, ERROR_MESSAGES.NOT_FOUND ?? "Note not found");
        if (existing.member_discord_id !== params.id) return bad(404, "Note not found");

        const { error } = await db.from("notes").delete().eq("id", parsed.data);
        if (error) return bad(500, error.message);

        await logAction("note_delete", g.user.discordId, {
          target: params.id,
          id: parsed.data,
          via: "api",
        });
        return Response.json({ ok: true });
      },
    },
  },
});
