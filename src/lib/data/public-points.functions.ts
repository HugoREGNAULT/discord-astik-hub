import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";

/**
 * Vue publique (toute la faction) :
 * - liste des valeurs actives (points par item / action)
 * - évolution % par rapport au point d'historique le plus ancien (>= 30j de préférence)
 * - ressources manquantes agrégées sur les projets en cours
 */
export const getPublicPoints = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();

  // 1. Valeurs actives
  const { data: values, error: vErr } = await db
    .from("config_values")
    .select("id, category, name, points, image_url, display_order")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("display_order", { ascending: true });
  if (vErr) throw new Error(vErr.message);

  const ids = (values ?? []).map((v) => v.id);

  // 2. Historique : pour chaque value_id, on prend le snapshot le plus ancien
  //    datant d'au moins 30 jours (fallback : le tout premier snapshot).
  let evolution: Record<string, { previous: number; deltaPct: number | null }> = {};
  if (ids.length > 0) {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: hist, error: hErr } = await db
      .from("config_values_history")
      .select("value_id, points, changed_at")
      .in("value_id", ids)
      .order("changed_at", { ascending: true });
    if (hErr) throw new Error(hErr.message);

    // Group per value
    const grouped = new Map<string, Array<{ points: number; changed_at: string }>>();
    for (const h of hist ?? []) {
      const arr = grouped.get(h.value_id) ?? [];
      arr.push({ points: Number(h.points), changed_at: h.changed_at });
      grouped.set(h.value_id, arr);
    }

    for (const v of values ?? []) {
      const series = grouped.get(v.id) ?? [];
      if (series.length === 0) continue;
      // Trouver le plus récent snapshot <= cutoff (sinon, le tout premier)
      const oldEnough = [...series].reverse().find((s) => s.changed_at <= cutoff);
      const baseline = oldEnough ?? series[0];
      const prev = Number(baseline.points);
      const curr = Number(v.points);
      const deltaPct = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
      evolution[v.id] = { previous: prev, deltaPct };
    }
  }

  // 3. Projets actifs + ressources manquantes
  const { data: projects, error: pErr } = await db
    .from("projects")
    .select("id, title, status, priority, deadline")
    .in("status", ["planned", "in_progress"])
    .order("priority", { ascending: false })
    .order("deadline", { ascending: true, nullsFirst: false });
  if (pErr) throw new Error(pErr.message);

  const projectIds = (projects ?? []).map((p) => p.id);
  let resources: any[] = [];
  if (projectIds.length > 0) {
    const { data: rs, error: rErr } = await db
      .from("project_resources")
      .select("project_id, item_name, qty_needed, qty_collected, unit_points")
      .in("project_id", projectIds);
    if (rErr) throw new Error(rErr.message);
    resources = rs ?? [];
  }

  // Agrégat par item
  const missingByItem = new Map<
    string,
    { item_name: string; qty_missing: number; unit_points: number; projects: string[] }
  >();
  const projectTitle = new Map<string, string>((projects ?? []).map((p) => [p.id, p.title]));
  for (const r of resources) {
    const missing = Math.max(0, Number(r.qty_needed) - Number(r.qty_collected));
    if (missing <= 0) continue;
    const key = r.item_name.toLowerCase();
    const existing = missingByItem.get(key);
    const title = projectTitle.get(r.project_id) ?? "";
    if (existing) {
      existing.qty_missing += missing;
      if (!existing.projects.includes(title)) existing.projects.push(title);
    } else {
      missingByItem.set(key, {
        item_name: r.item_name,
        qty_missing: missing,
        unit_points: Number(r.unit_points ?? 0),
        projects: title ? [title] : [],
      });
    }
  }
  const missingAggregated = Array.from(missingByItem.values()).sort(
    (a, b) => b.qty_missing - a.qty_missing,
  );

  return {
    values: values ?? [],
    evolution,
    projects: projects ?? [],
    missingAggregated,
  };
});
