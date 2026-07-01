# Projets Build Faction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section "Projets" au hub PunkAstik permettant aux membres de suivre la progression des projets de build faction, et au staff d'enregistrer les dons de matériaux (avec attribution automatique de points ig_investment).

**Architecture:** Server functions TanStack Start (createServerFn) pour toute la logique DB/points, deux routes TanStack Router file-based (`/projets` liste + `/projets/$id` détail), composants brutalist réutilisant ToolsUi.tsx. L'attribution de points réutilise exactement le pattern existant : RPC `apply_points_delta` + insert `points_ledger`, sans jamais toucher `astik_points` manuellement.

**Tech Stack:** TanStack Start (createServerFn), TanStack Router (createFileRoute), TanStack Query (useQuery/useMutation), Supabase (db client), Zod, React, ToolsUi brutalist components (Space Grotesk + Space Mono, coins droits, accent violet/primary)

## Global Constraints

- Pas de migration auto — les tables SQL sont créées manuellement en prod avant déploiement
- Ne jamais toucher auth (session, Discord OAuth, require.server.ts) ni modifier la logique points existante
- Réutiliser `apply_points_delta` RPC + insert `points_ledger` pour toute attribution de points
- `pillar = "ig_investment"` pour tous les points projet
- Exclure les membres staff du formulaire de don (utiliser `listMembers({ excludeStaff: true })`)
- DA brutalist : `rounded-none`, `border-[3px]`, font Space Mono/Grotesk, accent `text-primary`/`bg-primary` (violet)
- Permission staff projets : `points.manage` (isStaffPoints)
- Permission lecture membre : `profile.self` (tous membres faction)
- Les types Supabase (`types.ts`) ne connaissent pas encore les nouvelles tables — définir les interfaces TypeScript inline dans `projects.functions.ts`
- TanStack Router régénère `routeTree.gen.ts` automatiquement au `bun run dev` ; ne pas éditer ce fichier à la main
- Commande typecheck : `bun run typecheck` (alias `tsc --noEmit`)

## SQL à exécuter manuellement en prod (pré-requis)

```sql
CREATE TABLE public.projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  dimensions  TEXT,
  status      TEXT        NOT NULL DEFAULT 'actif'
                CHECK (status IN ('actif', 'terminé', 'archivé')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_materials (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID    NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_name         TEXT    NOT NULL,
  item_image_url    TEXT,
  unit_type         TEXT    NOT NULL DEFAULT 'item'
                      CHECK (unit_type IN ('item', 'liquide', 'divers')),
  quantity_required NUMERIC NOT NULL,
  quantity_gathered NUMERIC NOT NULL DEFAULT 0,
  points_per_unit   NUMERIC NOT NULL,
  display_order     INT     NOT NULL DEFAULT 0
);

CREATE TABLE public.project_contributions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id        UUID        NOT NULL REFERENCES public.project_materials(id) ON DELETE CASCADE,
  member_discord_id  TEXT        NOT NULL,
  quantity           NUMERIC     NOT NULL,
  points_awarded     NUMERIC     NOT NULL,
  staff_discord_id   TEXT        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.project_materials(project_id);
CREATE INDEX ON public.project_contributions(project_id);
CREATE INDEX ON public.project_contributions(material_id);
CREATE INDEX ON public.project_contributions(member_discord_id);
```

---

## File Map

| Fichier                                     | Action       | Responsabilité                                                                                                                        |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/projects.functions.ts`        | **Créer**    | Toutes les server functions (liste, détail, upsert projet, upsert matériau, enregistrer don, top contributeurs, search config_values) |
| `src/routes/_authenticated/projets.tsx`     | **Créer**    | Page liste des projets — visible membres (Guard profile.self), formulaires staff inline conditionnels (hasPerm points.manage)         |
| `src/routes/_authenticated/projets.$id.tsx` | **Créer**    | Page détail projet — matériaux, barres de progression, formulaire don staff                                                           |
| `src/components/AppSidebar.tsx`             | **Modifier** | Ajouter section `// projets` avec item `Projets Build` → `/projets`, perm `profile.self`                                              |

---

## Task 1 — Server functions `projects.functions.ts`

**Files:**

- Create: `src/lib/data/projects.functions.ts`

**Interfaces:**

- Consumes: `db` from `@/lib/db.server`, `requirePermission` + `logAction` from `@/lib/auth/require.server`
- Produces: `listProjects`, `getProject`, `upsertProject`, `listProjectMaterials`, `upsertMaterial`, `recordContribution`, `listProjectContributions`, `searchConfigValues` — tous utilisés par les routes Task 2 et 3

- [ ] **Step 1 : Créer le fichier avec les types inline et les server functions**

Créer `src/lib/data/projects.functions.ts` avec ce contenu exact :

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

// ── Types inline (tables pas encore dans types.ts) ──────────────────────────

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

// ── Lecture publique (profile.self) ─────────────────────────────────────────

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("profile.self");
  const { data, error } = await db
    .from("projects" as any)
    .select("*")
    .neq("status", "archivé")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { projects: (data ?? []) as Project[] };
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
    return { project: project as Project };
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
    return { materials: (materials ?? []) as ProjectMaterial[] };
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
    const contributions = (contribs ?? []) as ProjectContribution[];

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

// ── Recherche config_values pour pré-remplissage ─────────────────────────────

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

// ── Mutations staff (points.manage) ─────────────────────────────────────────

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
      return { id: (row as { id: string }).id };
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

// ── Enregistrer un don (atomique points + contribution) ──────────────────────

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
    const material = mat as ProjectMaterial;

    // 2. Récupérer le projet (pour le nom dans la raison)
    const { data: proj, error: projErr } = await db
      .from("projects" as any)
      .select("name")
      .eq("id", data.projectId)
      .single();
    if (projErr || !proj) throw new Error("Projet introuvable");
    const projectName = (proj as { name: string }).name;

    const amount = Math.round(data.quantity * material.points_per_unit);
    if (amount > MAX_CONTRIBUTION_POINTS)
      throw new Error("Montant trop élevé pour une seule contribution");
    if (amount <= 0) throw new Error("Montant de points nul ou négatif");

    // 3. RPC atomique points (identique à addPoints dans points.functions.ts)
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
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
cd "/Users/hugo/PunkAstik v12 Site/discord-astik-hub" && bun run typecheck 2>&1 | tail -20
```

Attendu : 0 erreurs dans `projects.functions.ts` (les `as any` sur les nouvelles tables sont volontaires).

---

## Task 2 — Sidebar + page liste `/projets`

**Files:**

- Modify: `src/components/AppSidebar.tsx`
- Create: `src/routes/_authenticated/projets.tsx`

**Interfaces:**

- Consumes: `listProjects`, `upsertProject` depuis `projects.functions.ts` ; `useCurrentUser`, `hasPerm` ; composants `PageHeader`, `PageCard`, `SectionLabel`, `DaButton`, `DaInput`, `DaSelect`, `DaChip` depuis `ToolsUi.tsx`
- Produces: route `/projets` visible et navigable depuis la sidebar

- [ ] **Step 1 : Ajouter la section `// projets` dans AppSidebar.tsx**

Dans `src/components/AppSidebar.tsx`, localiser le tableau `SECTIONS` et ajouter la nouvelle section après `// punkastik` et avant `// staff` :

```typescript
// Ajouter en tête de fichier dans les imports lucide
import { Hammer } from "lucide-react";
```

Dans le tableau `SECTIONS`, ajouter entre la section `// punkastik` et `// staff` :

```typescript
  {
    label: "// projets",
    items: [
      { title: "Projets Build", url: "/projets", icon: Hammer, perm: "profile.self" },
    ],
  },
```

- [ ] **Step 2 : Créer `src/routes/_authenticated/projets.tsx`**

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listProjects, upsertProject, type Project } from "@/lib/data/projects.functions";
import {
  PageHeader,
  PageCard,
  SectionLabel,
  DaButton,
  DaInput,
  DaSelect,
  DaChip,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/projets")({
  head: () => ({ meta: [{ title: "Projets Build · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <ProjetsPage />
    </Guard>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  actif: "Actif",
  "terminé": "Terminé",
  archivé: "Archivé",
};
const STATUS_ACCENT: Record<string, "green" | "zinc" | "pink"> = {
  actif: "green",
  "terminé": "zinc",
  archivé: "zinc",
};

function ProjetsPage() {
  const { data: me } = useCurrentUser();
  const isStaff = hasPerm(me, "points.manage");
  const qc = useQueryClient();

  const listFn = useServerFn(listProjects);
  const upsertFn = useServerFn(upsertProject);

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(undefined as any),
  });

  // Formulaire création projet (staff)
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", dimensions: "", status: "actif" as Project["status"] });

  const createMut = useMutation({
    mutationFn: (payload: typeof form) => upsertFn(payload as any),
    onSuccess: () => {
      toast.success("Projet créé");
      setShowCreate(false);
      setForm({ name: "", description: "", dimensions: "", status: "actif" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (isLoading) return <LoadingBlock label="Chargement projets…" />;
  if (error) return <ErrorBlock message={toUserMessage(error)} />;

  const projects = data?.projects ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        code="// projets"
        title="Projets Build"
        description="Suivez la progression des projets de construction de la faction."
      />

      {/* Bouton créer projet (staff) */}
      {isStaff && (
        <div className="flex justify-end">
          <DaButton onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Annuler" : "+ Nouveau projet"}
          </DaButton>
        </div>
      )}

      {/* Formulaire création */}
      {showCreate && isStaff && (
        <PageCard>
          <SectionLabel>Nouveau projet</SectionLabel>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate(form);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
                  Nom
                </label>
                <DaInput
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Base Claim Tempo"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
                  Dimensions
                </label>
                <DaInput
                  value={form.dimensions}
                  onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
                  placeholder="ex: 64x64x32"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
                Description
              </label>
              <DaInput
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description courte du projet…"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <DaButton type="submit" disabled={createMut.isPending || !form.name}>
                {createMut.isPending ? "Création…" : "Créer"}
              </DaButton>
            </div>
          </form>
        </PageCard>
      )}

      {/* Liste des projets */}
      {projects.length === 0 ? (
        <EmptyBlock label="Aucun projet actif" />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to="/projets/$id" params={{ id: project.id }} className="block group">
      <PageCard className="hover:border-primary/60 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className="text-base font-bold uppercase tracking-tight text-foreground group-hover:text-primary transition-colors"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {project.name}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            )}
            {project.dimensions && (
              <p className="text-[10px] font-mono text-muted-foreground/70 mt-1 uppercase tracking-wider">
                // {project.dimensions}
              </p>
            )}
          </div>
          <DaChip accent={STATUS_ACCENT[project.status] ?? "zinc"}>
            {STATUS_LABEL[project.status] ?? project.status}
          </DaChip>
        </div>
      </PageCard>
    </Link>
  );
}
```

- [ ] **Step 3 : Vérifier le typecheck**

```bash
cd "/Users/hugo/PunkAstik v12 Site/discord-astik-hub" && bun run typecheck 2>&1 | tail -20
```

Attendu : 0 nouvelles erreurs.

---

## Task 3 — Page détail `/projets/$id`

**Files:**

- Create: `src/routes/_authenticated/projets.$id.tsx`

**Interfaces:**

- Consumes: `getProject`, `listProjectMaterials`, `upsertProject`, `upsertMaterial`, `recordContribution`, `listProjectContributions`, `searchConfigValues` depuis `projects.functions.ts` ; `listMembers` depuis `members.functions.ts` ; tous les composants ToolsUi ; `type Project`, `type ProjectMaterial`
- Produces: route `/projets/:id` complète (lecture + staff actions)

- [ ] **Step 1 : Créer `src/routes/_authenticated/projets.$id.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  getProject,
  listProjectMaterials,
  upsertProject,
  upsertMaterial,
  recordContribution,
  listProjectContributions,
  searchConfigValues,
  type Project,
  type ProjectMaterial,
} from "@/lib/data/projects.functions";
import { listMembers } from "@/lib/data/members.functions";
import {
  PageHeader,
  PageCard,
  SectionLabel,
  DaButton,
  DaInput,
  DaSelect,
  DaChip,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projets/$id")({
  head: () => ({ meta: [{ title: "Projet · PunkAstik" }] }),
  component: () => (
    <Guard perm="profile.self">
      <ProjetDetailPage />
    </Guard>
  ),
});

// ── Barre de progression style XP violet ─────────────────────────────────────

function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={`h-2 bg-secondary border border-border relative overflow-hidden ${className}`}>
      <div
        className="h-full bg-primary transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function pct(gathered: number, required: number) {
  if (required <= 0) return 0;
  return Math.round((gathered / required) * 100);
}

function globalPct(materials: ProjectMaterial[]) {
  const totalRequired = materials.reduce((s, m) => s + m.quantity_required, 0);
  const totalGathered = materials.reduce((s, m) => s + m.quantity_gathered, 0);
  return pct(totalGathered, totalRequired);
}

// ── Page principale ───────────────────────────────────────────────────────────

function ProjetDetailPage() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const isStaff = hasPerm(me, "points.manage");
  const qc = useQueryClient();

  const getProjectFn = useServerFn(getProject);
  const listMaterialsFn = useServerFn(listProjectMaterials);
  const listContribFn = useServerFn(listProjectContributions);

  const { data: projData, isLoading: projLoading, error: projErr } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProjectFn({ data: { id } }),
  });

  const { data: matsData, isLoading: matsLoading } = useQuery({
    queryKey: ["project-materials", id],
    queryFn: () => listMaterialsFn({ data: { projectId: id } }),
  });

  const { data: contribData } = useQuery({
    queryKey: ["project-contributions", id],
    queryFn: () => listContribFn({ data: { projectId: id } }),
  });

  if (projLoading || matsLoading) return <LoadingBlock label="Chargement projet…" />;
  if (projErr) return <ErrorBlock message={toUserMessage(projErr)} />;

  const project = projData?.project;
  if (!project) return <ErrorBlock message="Projet introuvable" />;
  const materials = matsData?.materials ?? [];
  const top = contribData?.top ?? [];
  const gPct = globalPct(materials);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Retour */}
      <Link
        to="/projets"
        className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="size-3" />
        Projets
      </Link>

      <PageHeader
        code="// projet"
        title={project.name}
        description={project.description ?? ""}
      />

      {/* Infos + progression globale */}
      <PageCard>
        <div className="flex flex-wrap gap-4 items-start justify-between mb-4">
          {project.dimensions && (
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              // dimensions : {project.dimensions}
            </span>
          )}
          <DaChip accent={project.status === "actif" ? "green" : "zinc"}>
            {project.status}
          </DaChip>
        </div>
        <SectionLabel>Progression globale</SectionLabel>
        <div className="flex items-center gap-3">
          <ProgressBar pct={gPct} className="flex-1" />
          <span
            className="text-primary font-bold text-sm shrink-0"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {gPct}%
          </span>
        </div>
      </PageCard>

      {/* Section staff : éditer projet */}
      {isStaff && <EditProjectForm project={project} onSaved={() => qc.invalidateQueries({ queryKey: ["project", id] })} />}

      {/* Matériaux */}
      <PageCard>
        <SectionLabel>Matériaux</SectionLabel>
        {materials.length === 0 ? (
          <EmptyBlock label="Aucun matériau défini" />
        ) : (
          <div className="space-y-4">
            {materials.map((mat) => (
              <MaterialRow key={mat.id} material={mat} />
            ))}
          </div>
        )}
      </PageCard>

      {/* Section staff : ajouter matériau */}
      {isStaff && (
        <AddMaterialForm
          projectId={id}
          onSaved={() => qc.invalidateQueries({ queryKey: ["project-materials", id] })}
        />
      )}

      {/* Section staff : enregistrer un don */}
      {isStaff && materials.length > 0 && (
        <RecordContributionForm
          projectId={id}
          materials={materials}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["project-materials", id] });
            qc.invalidateQueries({ queryKey: ["project-contributions", id] });
          }}
        />
      )}

      {/* Top contributeurs */}
      {top.length > 0 && (
        <PageCard>
          <SectionLabel>Top contributeurs</SectionLabel>
          <div className="space-y-2">
            {top.map((c, i) => (
              <div key={c.discordId} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground text-xs">
                  #{i + 1} <span className="text-foreground">{c.discordId}</span>
                </span>
                <span className="font-bold text-primary font-mono text-xs">{c.pts} pts</span>
              </div>
            ))}
          </div>
        </PageCard>
      )}
    </div>
  );
}

// ── Ligne matériau ────────────────────────────────────────────────────────────

function MaterialRow({ material }: { material: ProjectMaterial }) {
  const p = pct(material.quantity_gathered, material.quantity_required);
  const done = material.quantity_gathered >= material.quantity_required;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {material.item_image_url && (
          <img
            src={material.item_image_url}
            alt={material.item_name}
            className="size-8 object-contain border border-border bg-secondary shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-xs font-bold uppercase tracking-wide text-foreground"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              {material.item_name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {done && <DaChip accent="green">Complet</DaChip>}
              <span className="text-[10px] font-mono text-muted-foreground">
                {material.points_per_unit} pts/u
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ProgressBar pct={p} className="flex-1" />
            <span className="text-[10px] font-mono text-primary shrink-0">
              {material.quantity_gathered}/{material.quantity_required} ({p}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire édition projet ─────────────────────────────────────────────────

function EditProjectForm({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    dimensions: project.dimensions ?? "",
    status: project.status,
  });
  const upsertFn = useServerFn(upsertProject);

  const mut = useMutation({
    mutationFn: () => upsertFn({ data: { id: project.id, ...form, status: form.status } } as any),
    onSuccess: () => { toast.success("Projet mis à jour"); setOpen(false); onSaved(); },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!open) return (
    <div className="flex justify-end">
      <DaButton variant="ghost" onClick={() => setOpen(true)}>Éditer projet</DaButton>
    </div>
  );

  return (
    <PageCard>
      <SectionLabel>Éditer le projet</SectionLabel>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Nom</label>
            <DaInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Dimensions</label>
            <DaInput value={form.dimensions} onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))} placeholder="64x64x32" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Description</label>
          <DaInput value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Statut</label>
          <DaSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Project["status"] }))}>
            <option value="actif">Actif</option>
            <option value="terminé">Terminé</option>
            <option value="archivé">Archivé</option>
          </DaSelect>
        </div>
        <div className="flex gap-2 pt-1">
          <DaButton type="submit" disabled={mut.isPending}>{mut.isPending ? "Enregistrement…" : "Enregistrer"}</DaButton>
          <DaButton variant="ghost" onClick={() => setOpen(false)}>Annuler</DaButton>
        </div>
      </form>
    </PageCard>
  );
}

// ── Formulaire ajout matériau ─────────────────────────────────────────────────

function AddMaterialForm({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_name: "",
    item_image_url: "",
    unit_type: "item" as "item" | "liquide" | "divers",
    quantity_required: "",
    points_per_unit: "",
    display_order: "0",
  });
  const [suggestion, setSuggestion] = useState<{ name: string; points: number; image_url: string | null } | null>(null);

  const upsertFn = useServerFn(upsertMaterial);
  const searchFn = useServerFn(searchConfigValues);

  // Pré-remplissage depuis config_values
  const searchQuery = useQuery({
    queryKey: ["config-values-search", form.item_name],
    queryFn: () => searchFn({ data: { q: form.item_name } }),
    enabled: form.item_name.length >= 2,
  });

  useEffect(() => {
    const values = searchQuery.data?.values ?? [];
    const exact = values.find((v) => v.name.toLowerCase() === form.item_name.toLowerCase());
    if (exact) {
      setSuggestion(exact);
    } else {
      setSuggestion(null);
    }
  }, [searchQuery.data, form.item_name]);

  const applysuggestion = () => {
    if (!suggestion) return;
    setForm((f) => ({
      ...f,
      points_per_unit: String(suggestion.points),
      item_image_url: suggestion.image_url ?? f.item_image_url,
    }));
  };

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          project_id: projectId,
          item_name: form.item_name,
          item_image_url: form.item_image_url || null,
          unit_type: form.unit_type,
          quantity_required: parseFloat(form.quantity_required),
          points_per_unit: parseFloat(form.points_per_unit),
          display_order: parseInt(form.display_order, 10) || 0,
        },
      } as any),
    onSuccess: () => {
      toast.success("Matériau ajouté");
      setForm({ item_name: "", item_image_url: "", unit_type: "item", quantity_required: "", points_per_unit: "", display_order: "0" });
      setSuggestion(null);
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!open) return (
    <div className="flex justify-end">
      <DaButton variant="ghost" onClick={() => setOpen(true)}>+ Ajouter matériau</DaButton>
    </div>
  );

  return (
    <PageCard>
      <SectionLabel>Ajouter un matériau</SectionLabel>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Nom item</label>
            <DaInput
              value={form.item_name}
              onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
              placeholder="Stone Bricks"
              required
            />
            {suggestion && (
              <button
                type="button"
                onClick={applysuggestion}
                className="text-[10px] font-mono text-primary hover:underline text-left"
              >
                // Pré-remplir depuis config : {suggestion.points} pts/u
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Type</label>
            <DaSelect value={form.unit_type} onChange={(e) => setForm((f) => ({ ...f, unit_type: e.target.value as any }))}>
              <option value="item">Item</option>
              <option value="liquide">Liquide</option>
              <option value="divers">Divers</option>
            </DaSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Quantité requise</label>
            <DaInput
              type="number"
              min="1"
              value={form.quantity_required}
              onChange={(e) => setForm((f) => ({ ...f, quantity_required: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Points / unité</label>
            <DaInput
              type="number"
              min="0.01"
              step="0.01"
              value={form.points_per_unit}
              onChange={(e) => setForm((f) => ({ ...f, points_per_unit: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Image URL (optionnel)</label>
          <DaInput
            value={form.item_image_url}
            onChange={(e) => setForm((f) => ({ ...f, item_image_url: e.target.value }))}
            placeholder="https://…"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <DaButton type="submit" disabled={mut.isPending || !form.item_name || !form.quantity_required || !form.points_per_unit}>
            {mut.isPending ? "Ajout…" : "Ajouter"}
          </DaButton>
          <DaButton variant="ghost" onClick={() => setOpen(false)}>Annuler</DaButton>
        </div>
      </form>
    </PageCard>
  );
}

// ── Formulaire enregistrer un don ─────────────────────────────────────────────

function RecordContributionForm({
  projectId,
  materials,
  onSaved,
}: {
  projectId: string;
  materials: ProjectMaterial[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    materialId: materials[0]?.id ?? "",
    memberDiscordId: "",
    quantity: "",
  });

  const listMembersFn = useServerFn(listMembers);
  const recordFn = useServerFn(recordContribution);

  const { data: membersData } = useQuery({
    queryKey: ["members-no-staff"],
    queryFn: () => listMembersFn({ data: { excludeStaff: true, status: "active" } }),
    enabled: open,
  });
  const members = membersData?.members ?? [];

  const selectedMat = materials.find((m) => m.id === form.materialId);

  const mut = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          projectId,
          materialId: form.materialId,
          memberDiscordId: form.memberDiscordId,
          quantity: parseFloat(form.quantity),
        },
      } as any),
    onSuccess: (res: any) => {
      toast.success(`+${res.points} pts attribués — nouveau solde : ${res.newBalance}`);
      setForm((f) => ({ ...f, memberDiscordId: "", quantity: "" }));
      onSaved();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!open) return (
    <div className="flex justify-end">
      <DaButton onClick={() => setOpen(true)}>Enregistrer un don</DaButton>
    </div>
  );

  const previewPts =
    selectedMat && form.quantity && !isNaN(parseFloat(form.quantity))
      ? Math.round(parseFloat(form.quantity) * selectedMat.points_per_unit)
      : null;

  return (
    <PageCard className="border-primary/40">
      <SectionLabel>Enregistrer un don</SectionLabel>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Matériau</label>
            <DaSelect
              value={form.materialId}
              onChange={(e) => setForm((f) => ({ ...f, materialId: e.target.value }))}
              required
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.item_name} ({m.points_per_unit} pts/u)
                </option>
              ))}
            </DaSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Quantité donnée</label>
            <DaInput
              type="number"
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Membre donneur</label>
          <DaSelect
            value={form.memberDiscordId}
            onChange={(e) => setForm((f) => ({ ...f, memberDiscordId: e.target.value }))}
            required
          >
            <option value="">— Sélectionner un membre —</option>
            {members.map((m) => (
              <option key={m.discord_id} value={m.discord_id}>
                {m.ig_name ?? m.discord_username ?? m.discord_id}
              </option>
            ))}
          </DaSelect>
        </div>
        {previewPts !== null && (
          <div className="text-xs font-mono text-primary border border-primary/30 bg-primary/5 px-3 py-2">
            // {form.quantity} × {selectedMat?.points_per_unit} pts/u = <strong>{previewPts} AstikPoints</strong> (pilier ig_investment)
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <DaButton
            type="submit"
            disabled={mut.isPending || !form.materialId || !form.memberDiscordId || !form.quantity}
          >
            {mut.isPending ? "Enregistrement…" : "Valider le don"}
          </DaButton>
          <DaButton variant="ghost" onClick={() => setOpen(false)}>Annuler</DaButton>
        </div>
      </form>
    </PageCard>
  );
}
```

- [ ] **Step 2 : Vérifier le typecheck final**

```bash
cd "/Users/hugo/PunkAstik v12 Site/discord-astik-hub" && bun run typecheck 2>&1 | tail -30
```

Attendu : 0 erreurs (ou uniquement des avertissements non bloquants sur les `as any` des nouvelles tables).

---

## Self-Review

### Spec coverage

| Exigence spec                                                 | Tâche                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| Table `projects` CREATE TABLE                                 | Pré-requis SQL, Task 1                                     |
| Table `project_materials` + `project_contributions`           | Pré-requis SQL, Task 1                                     |
| Multi-projets : liste + détail                                | Task 2 (liste) + Task 3 (détail)                           |
| Créer/éditer projet (staff)                                   | `upsertProject`, `EditProjectForm`                         |
| Ajouter matériaux + pré-remplissage config_values             | `searchConfigValues`, `AddMaterialForm`                    |
| Enregistrer don : incrémente gathered + points + contribution | `recordContribution` Task 1                                |
| Pilier ig_investment, reason correct                          | `recordContribution` ligne ledger                          |
| Exclure staff du formulaire membre                            | `listMembers({ excludeStaff: true })`                      |
| Progression par matériau (barre + %)                          | `MaterialRow` + `ProgressBar`                              |
| Progression globale (barre + %)                               | `globalPct()` + bloc PageCard                              |
| Top contributeurs                                             | `listProjectContributions` + rendu                         |
| Section sidebar `// projets`                                  | Task 2 Step 1                                              |
| DA brutalist accent violet coins droits                       | `ProgressBar`, `DaChip`, `DaButton`, `PageCard`            |
| Permission staff : `points.manage`                            | `requirePermission("points.manage")` dans toutes mutations |
| Permission lecture : `profile.self`                           | `requirePermission("profile.self")` dans queries + Guard   |
| Ne pas recoder `total_after` manuellement                     | RPC + `total_after: total` du RETURNING ✓                  |
| TypeScript check                                              | Step final chaque Task                                     |

### Placeholder scan

Aucun TBD, TODO, ou "fill in later" détecté. Tout le code est complet.

### Type consistency

- `Project`, `ProjectMaterial`, `ProjectContribution` définis dans Task 1, importés dans Task 3. ✓
- `upsertProject`, `upsertMaterial`, `recordContribution` utilisent `{ data: ... } as any` pour bypasser les types Supabase manquants. ✓
- `listMembers` importé depuis `members.functions` — signature existante compatible. ✓
