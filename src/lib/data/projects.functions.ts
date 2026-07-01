import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

// ── Types inline (tables pas encore dans types.ts) ───────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  dimensions: string | null;
  status: "actif" | "terminé" | "archivé";
  created_at: string;
}

export interface ProjectMaterial {
  id: string;
  project_id: string;
  item_name: string;
  item_image_url: string | null;
  unit_type: "item" | "liquide" | "divers";
  quantity_required: number;
  quantity_gathered: number;
  points_per_unit: number;
  display_order: number;
}

export interface ProjectContribution {
  id: string;
  project_id: string;
  material_id: string;
  member_discord_id: string;
  quantity: number;
  points_awarded: number;
  staff_discord_id: string;
  created_at: string;
}

// ── Lecture publique (profile.self) ──────────────────────────────────────────

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("profile.self");
  const { data, error } = await db
    .from("projects" as any)
    .select("*")
    .neq("status", "archivé")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { projects: (data ?? []) as unknown as Project[] };
});

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("profile.self");
    const { data: project, error } = await db
      .from("projects" as any)
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !project) throw new Error("Projet introuvable");
    return { project: project as unknown as Project };
  });

export const listProjectMaterials = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("profile.self");
    const { data: materials, error } = await db
      .from("project_materials" as any)
      .select("*")
      .eq("project_id", data.projectId)
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { materials: (materials ?? []) as unknown as ProjectMaterial[] };
  });

export const listProjectContributions = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("profile.self");
    const { data: contribs, error } = await db
      .from("project_contributions" as any)
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const contributions = (contribs ?? []) as unknown as ProjectContribution[];

    // Top contributeurs : agréger par member_discord_id
    const totals: Record<string, number> = {};
    for (const c of contributions) {
      totals[c.member_discord_id] = (totals[c.member_discord_id] ?? 0) + c.points_awarded;
    }
    const top = Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([discordId, pts]) => ({ discordId, pts }));

    return { contributions, top };
  });

// ── Recherche config_values pour pré-remplissage ──────────────────────────────

export const searchConfigValues = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ q: z.string().max(100) }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: rows, error } = await db
      .from("config_values")
      .select("id, name, points, image_url")
      .eq("category", "item")
      .eq("active", true)
      .ilike("name", `%${data.q}%`)
      .order("name", { ascending: true })
      .limit(10);
    if (error) throw new Error(error.message);
    return {
      values: (rows ?? []) as {
        id: string;
        name: string;
        points: number;
        image_url: string | null;
      }[],
    };
  });

// ── Mutations staff (points.manage) ──────────────────────────────────────────

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  dimensions: z.string().max(200).nullable().optional(),
  status: z.enum(["actif", "terminé", "archivé"]).default("actif"),
});

export const upsertProject = createServerFn({ method: "POST" })
  .inputValidator((input) => projectSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { id, ...fields } = data;
    if (id) {
      const { error } = await db
        .from("projects" as any)
        .update(fields)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logAction("project_update", user.discordId, { id, ...fields });
      return { id };
    } else {
      const { data: row, error } = await db
        .from("projects" as any)
        .insert(fields)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logAction("project_create", user.discordId, { ...fields });
      return { id: (row as unknown as { id: string }).id };
    }
  });

const materialSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  item_name: z.string().min(1).max(120),
  item_image_url: z.string().url().nullable().optional(),
  unit_type: z.enum(["item", "liquide", "divers"]).default("item"),
  quantity_required: z.number().positive(),
  quantity_gathered: z.number().min(0).optional(),
  points_per_unit: z.number().positive(),
  display_order: z.number().int().default(0),
});

export const upsertMaterial = createServerFn({ method: "POST" })
  .inputValidator((input) => materialSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { id, ...fields } = data;
    if (id) {
      const { error } = await db
        .from("project_materials" as any)
        .update(fields)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("project_materials" as any).insert(fields);
      if (error) throw new Error(error.message);
    }
    await logAction("project_material_upsert", user.discordId, { id, ...fields });
    return { ok: true };
  });

// ── Enregistrer un don (atomique points + contribution) ───────────────────────

const MAX_CONTRIBUTION_POINTS = 100_000;

export const recordContribution = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        materialId: z.string().uuid(),
        memberDiscordId: z.string().min(1),
        quantity: z.number().positive().max(100_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");

    // 1. Récupérer le matériau (vérifie qu'il appartient bien au projet)
    const { data: mat, error: matErr } = await db
      .from("project_materials" as any)
      .select("*")
      .eq("id", data.materialId)
      .eq("project_id", data.projectId)
      .single();
    if (matErr || !mat) throw new Error("Matériau introuvable pour ce projet");
    const material = mat as unknown as ProjectMaterial;

    // 2. Récupérer le projet (pour le nom dans la raison)
    const { data: proj, error: projErr } = await db
      .from("projects" as any)
      .select("name")
      .eq("id", data.projectId)
      .single();
    if (projErr || !proj) throw new Error("Projet introuvable");
    const projectName = (proj as unknown as { name: string }).name;

    const amount = Math.round(data.quantity * material.points_per_unit);
    if (amount > MAX_CONTRIBUTION_POINTS)
      throw new Error("Montant trop élevé pour une seule contribution");
    if (amount <= 0) throw new Error("Montant de points nul ou négatif");

    // 3. RPC atomique (identique à addPoints dans points.functions.ts)
    const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
      p_discord_id: data.memberDiscordId,
      p_delta: amount,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (newBalance === null || newBalance === undefined) throw new Error("Membre introuvable");
    const total = newBalance as number;

    // 4. Ledger (le trigger trg_sync_member_points synchronise members.astik_points)
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount,
      reason: `Projet ${projectName} — ${material.item_name}`,
      bonus_pct: 0,
      total_after: total,
      action_type: "add",
      pillar: "ig_investment",
    });

    // 5. Incrémenter quantity_gathered
    const { error: updErr } = await db
      .from("project_materials" as any)
      .update({ quantity_gathered: material.quantity_gathered + data.quantity })
      .eq("id", data.materialId);
    if (updErr) throw new Error(updErr.message);

    // 6. Trace contribution
    await db.from("project_contributions" as any).insert({
      project_id: data.projectId,
      material_id: data.materialId,
      member_discord_id: data.memberDiscordId,
      quantity: data.quantity,
      points_awarded: amount,
      staff_discord_id: user.discordId,
    });

    await logAction("project_contribution", user.discordId, {
      projectId: data.projectId,
      materialId: data.materialId,
      member: data.memberDiscordId,
      quantity: data.quantity,
      points: amount,
    });

    return { ok: true, points: amount, newBalance: total };
  });

// ── Annulation de contribution ────────────────────────────────────────────────

export const reverseContribution = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ contributionId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");

    const { data: row, error: fetchErr } = await db
      .from("project_contributions" as any)
      .select("*")
      .eq("id", data.contributionId)
      .single();
    if (fetchErr || !row) throw new Error("Contribution introuvable");
    const contribution = row as unknown as ProjectContribution;

    // Idempotence : vérifier qu'il n'y a pas déjà un reversal pour cette contribution
    const { count } = await db
      .from("points_ledger")
      .select("id", { count: "exact", head: true })
      .eq("member_discord_id", contribution.member_discord_id)
      .eq("action_type", "reversal")
      .like("reason", `[rev-proj:${data.contributionId}]%`);
    if (count && count > 0) throw new Error("Cette contribution a déjà été annulée");

    // Noms pour la raison ledger
    const { data: matRow } = await db
      .from("project_materials" as any)
      .select("item_name, quantity_gathered")
      .eq("id", contribution.material_id)
      .single();
    const material = matRow as unknown as Pick<
      ProjectMaterial,
      "item_name" | "quantity_gathered"
    > | null;

    const { data: projRow } = await db
      .from("projects" as any)
      .select("name")
      .eq("id", contribution.project_id)
      .single();
    const projectName = (projRow as unknown as { name: string } | null)?.name ?? "Projet";

    // RPC inverse (même pattern que reversePointsTransaction dans points.functions.ts)
    const { data: newBalance, error: rpcErr } = await db.rpc("apply_points_delta", {
      p_discord_id: contribution.member_discord_id,
      p_delta: -contribution.points_awarded,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (newBalance === null || newBalance === undefined) throw new Error("Membre introuvable");
    const total = newBalance as number;

    await db.from("points_ledger").insert({
      member_discord_id: contribution.member_discord_id,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: -contribution.points_awarded,
      reason: `[rev-proj:${data.contributionId}] Annulation don ${projectName} — ${material?.item_name ?? ""}`,
      bonus_pct: 0,
      total_after: total,
      action_type: "reversal",
      pillar: "ig_investment",
    });

    // Décrémente quantity_gathered (clamp à 0)
    if (material !== null) {
      await db
        .from("project_materials" as any)
        .update({
          quantity_gathered: Math.max(0, material.quantity_gathered - contribution.quantity),
        })
        .eq("id", contribution.material_id);
    }

    // Suppression de la ligne (trace conservée dans le ledger)
    await db
      .from("project_contributions" as any)
      .delete()
      .eq("id", data.contributionId);

    await logAction("project_contribution_reverse", user.discordId, {
      contributionId: data.contributionId,
      member: contribution.member_discord_id,
      points: -contribution.points_awarded,
    });

    return { ok: true, newBalance: total };
  });

// ── Suppression matériau ──────────────────────────────────────────────────────

export const deleteMaterial = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ materialId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { count, error: countErr } = await db
      .from("project_contributions" as any)
      .select("id", { count: "exact", head: true })
      .eq("material_id", data.materialId);
    if (countErr) throw new Error(countErr.message);
    if (count && count > 0)
      throw new Error(
        `Ce matériau a ${count} don(s) enregistré(s). Annulez d'abord toutes les contributions.`,
      );
    const { error } = await db
      .from("project_materials" as any)
      .delete()
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    await logAction("project_material_delete", user.discordId, { materialId: data.materialId });
    return { ok: true };
  });

// ── Archivage / Suppression projet ───────────────────────────────────────────

export const deleteOrArchiveProject = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { count } = await db
      .from("project_contributions" as any)
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId);

    if (count && count > 0) {
      // Contributions existantes → archiver pour préserver l'historique de points
      const { error } = await db
        .from("projects" as any)
        .update({ status: "archivé" })
        .eq("id", data.projectId);
      if (error) throw new Error(error.message);
      await logAction("project_archive", user.discordId, { projectId: data.projectId });
      return { ok: true, action: "archived" as const };
    }

    // Aucune contribution → suppression complète
    const { error } = await db
      .from("projects" as any)
      .delete()
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    await logAction("project_delete", user.discordId, { projectId: data.projectId });
    return { ok: true, action: "deleted" as const };
  });
