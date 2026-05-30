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
import { filterFactionMembers } from "@/lib/data/faction-members";

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
      to: "/members/$id";
      params: { id: string };
    }
  | {
      kind: "points";
      id: string;
      label: string;
      sub?: string;
      amount: number;
      to: "/members/$id";
      params: { id: string };
    };

export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { q: string; filter?: "member" | "application" | "donation" | "points" }) =>
      z
        .object({
          q: z.string().max(100),
          filter: z.enum(["member", "application", "donation", "points"]).optional(),
        })
        .parse(input),
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
        .select("discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid, status")
        .or(`discord_id.ilike.${like},discord_username.ilike.${like},ig_name.ilike.${like}`)
        .limit(8);

      /* Doublons / alts */
      const altR = await db
        .from("member_alts")
        .select("member_discord_id, alt_name, alt_discord_id")
        .or(`alt_name.ilike.${like},alt_discord_id.ilike.${like}`)
        .limit(8);

      const altMap = new Map<string, { alt_name: string | null; alt_discord_id: string | null }>();
      for (const a of altR.data ?? []) {
        if (!altMap.has(a.member_discord_id)) altMap.set(a.member_discord_id, a);
      }

      const existingIds = new Set((r.data ?? []).map((m) => m.discord_id));
      const missingIds = [...altMap.keys()].filter((id) => !existingIds.has(id));

      let extraMembers: any[] = [];
      if (missingIds.length > 0) {
        const extraR = await db
          .from("members")
          .select("discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid, status")
          .in("discord_id", missingIds);
        extraMembers = extraR.data ?? [];
      }

      for (const m of filterFactionMembers(r.data ?? [])) {
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

      for (const m of filterFactionMembers(extraMembers)) {
        const alt = altMap.get(m.discord_id)!;
        hits.push({
          kind: "member",
          id: m.discord_id,
          label: m.ig_name ?? m.discord_username ?? m.discord_id,
          sub: `@${m.discord_username ?? "—"} · ${m.current_grade ?? "—"} · alt: ${alt.alt_name ?? alt.alt_discord_id ?? "?"}`,
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
    if ((!filter || filter === "donation") && canAccess(user, "donations.manage")) {
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
          to: "/members/$id",
          params: { id: d.member_discord_id ?? d.id },
        });
      }
    }

    /* AstikPoints — staff voit tout, sinon ses propres mouvements */
    if (!filter || filter === "points") {
      const canManagePoints = canAccess(user, "points.manage");
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
          to: "/members/$id",
          params: { id: p.member_discord_id ?? p.id },
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
