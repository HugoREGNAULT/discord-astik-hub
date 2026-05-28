/**
 * Notifications "dérivées" — pas de table dédiée.
 * On agrège les événements pertinents pour l'utilisateur connecté :
 *  - gains/pertes AstikPoints récents (le concernant)
 *  - warnings récents reçus
 *  - pour le staff recruitment : candidatures pending
 *  - pour le staff donations : dons en attente d'expiration
 *
 * Le "lu / non-lu" est géré côté client via localStorage (dernier timestamp vu).
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";
import { canAccess } from "@/lib/auth/permissions";

export type NotificationItem = {
  id: string;
  kind: "points" | "warning" | "application" | "donation";
  title: string;
  detail?: string;
  href?: string;
  createdAt: string;
};

export const getMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const tasks: Promise<NotificationItem[]>[] = [];

  // Mes points (30j)
  tasks.push(
    db
      .from("points_ledger")
      .select("id, amount, reason, action_type, created_at")
      .eq("member_discord_id", user.discordId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15)
      .then((r) =>
        (r.data ?? []).map((g): NotificationItem => ({
          id: `pts-${g.id}`,
          kind: "points",
          title: `${g.amount >= 0 ? "+" : ""}${g.amount} AstikPoints`,
          detail: g.reason ?? g.action_type,
          href: "/me",
          createdAt: g.created_at,
        })),
      ),
  );

  // Mes warnings (30j)
  tasks.push(
    db
      .from("warnings")
      .select("id, body, created_at")
      .eq("member_discord_id", user.discordId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5)
      .then((r) =>
        (r.data ?? []).map((w): NotificationItem => ({
          id: `warn-${w.id}`,
          kind: "warning",
          title: "Nouvel avertissement",
          detail: w.body.slice(0, 120),
          href: "/me",
          createdAt: w.created_at,
        })),
      ),
  );

  // Candidatures pending (staff recrut)
  if (canAccess(user, "recruit.access")) {
    tasks.push(
      db
        .from("applications")
        .select("id, mc_name, discord_username, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r) =>
          (r.data ?? []).map((a): NotificationItem => ({
            id: `app-${a.id}`,
            kind: "application",
            title: `Candidature : ${a.mc_name}`,
            detail: `@${a.discord_username}`,
            href: "/recruitment",
            createdAt: a.created_at,
          })),
        ),
    );
  }

  // Dons en attente (staff points)
  if (canAccess(user, "donations.manage")) {
    tasks.push(
      db
        .from("donations")
        .select("id, staff_username, total_final, expires_at, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r) =>
          (r.data ?? []).map((d): NotificationItem => ({
            id: `don-${d.id}`,
            kind: "donation",
            title: `Don actif (${d.total_final} pts)`,
            detail: `par ${d.staff_username ?? "—"}`,
            href: "/donations",
            createdAt: d.created_at,
          })),
        ),
    );
  }

  const all = (await Promise.all(tasks)).flat();
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { items: all.slice(0, 30) };
});
