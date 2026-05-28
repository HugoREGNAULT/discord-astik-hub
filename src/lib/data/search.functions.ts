/**
 * Recherche globale pour la palette Cmd+K.
 * Agrège plusieurs sources selon les permissions de l'utilisateur :
 *  - membres (members.view)
 *  - candidatures (recruit.access)
 *  - dons (donations.manage)
 *  - mouvements AstikPoints (points.manage OU son propre historique)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";
import { canAccess } from "@/lib/auth/permissions";

export type SearchHit =
  | {
      kind: "member";
      id: string;
      label: string;
      sub?: string;
      avatarUrl?: string | null;
      grade?: string | null;
      to: "/members/$id";
      params: { id: string };
    }
  | {
      kind: "application";
      id: string;
      label: string;
      sub?: string;
      status: string;
      to: "/recruitment";
    }
  | {
      kind: "donation";
      id: string;
      label: string;
      sub?: string;
      total: number;
      status: string;
      to: "/donations";
    }
  | {
      kind: "points";
      id: string;
      label: string;
      sub?: string;
      amount: number;
      to: "/points";
    };

export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string; filter?: "member" | "application" | "donation" | "points" }) =>
    z.object({ q: z.string().max(100), filter: z.enum(["member", "application", "donation", "points"]).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ hits: SearchHit[] }> => {
    const user = await requireSession();
    const raw = data.q.trim();
    if (raw.length < 1) return { hits: [] };
    const needle = raw.toLowerCase();
    const like = `%${raw}%`;
    const filter = data.filter;

    const hits: SearchHit[] = [];

    /* Membres */
    if ((!filter || filter === "member") && canAccess(user, "members.view")) {
      const r = await db
        .from("members")
        .select("discord_id, discord_username, ig_name, avatar_url, current_grade, status")
        .or(
          `discord_id.ilike.${like},discord_username.ilike.${like},ig_name.ilike.${like}`,
        )
        .limit(8);
      for (const m of r.data ?? []) {
        hits.push({
          kind: "member",
          id: m.discord_id,
          label: m.ig_name ?? m.discord_username ?? m.discord_id,
          sub: `@${m.discord_username ?? "—"} · ${m.current_grade ?? "—"}`,
          avatarUrl: m.avatar_url,
          grade: m.current_grade,
          to: "/members/$id",
          params: { id: m.discord_id },
        });
      }
    }

    /* Candidatures */
    if ((!filter || filter === "application") && canAccess(user, "recruit.access")) {
      const r = await db
        .from("applications")
        .select("id, mc_name, discord_username, status, created_at")
        .or(`mc_name.ilike.${like},discord_username.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(6);
      for (const a of r.data ?? []) {
        hits.push({
          kind: "application",
          id: a.id,
          label: a.mc_name,
          sub: `@${a.discord_username} · ${a.status}`,
          status: a.status,
          to: "/recruitment",
        });
      }
    }

    /* Dons (par membre concerné, staff ou bonus) */
    if (canAccess(user, "donations.manage")) {
      const r = await db
        .from("donations")
        .select("id, member_discord_id, staff_username, total_final, status, created_at")
        .or(`member_discord_id.ilike.${like},staff_username.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(6);
      for (const d of r.data ?? []) {
        hits.push({
          kind: "donation",
          id: d.id,
          label: `${d.total_final} pts`,
          sub: `${d.member_discord_id ?? "—"} · ${d.staff_username ?? "—"} · ${d.status}`,
          total: d.total_final,
          status: d.status,
          to: "/donations",
        });
      }
    }

    /* AstikPoints — staff voit tout, sinon ses propres mouvements */
    const canManagePoints = canAccess(user, "points.manage");
    {
      let q = db
        .from("points_ledger")
        .select("id, member_discord_id, amount, reason, action_type, created_at")
        .or(`reason.ilike.${like},action_type.ilike.${like},member_discord_id.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(6);
      if (!canManagePoints) {
        q = q.eq("member_discord_id", user.discordId);
      }
      const r = await q;
      for (const p of r.data ?? []) {
        hits.push({
          kind: "points",
          id: p.id,
          label: `${p.amount >= 0 ? "+" : ""}${p.amount} — ${p.reason ?? p.action_type}`,
          sub: `${p.member_discord_id} · ${new Date(p.created_at).toLocaleDateString("fr-FR")}`,
          amount: p.amount,
          to: "/points",
        });
      }
    }

    // léger boost : match exact début de chaîne en premier
    hits.sort((a, b) => {
      const aStart = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStart = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
      return aStart - bStart;
    });

    return { hits };
  });
