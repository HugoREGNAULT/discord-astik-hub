# Points — Motifs prédéfinis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire une table `point_reasons` de motifs lisibles staff-gérables ; le formulaire d'attribution propose un sélecteur de motif qui pré-remplit pilier et raison.

**Architecture :** Migration SQL unique — CREATE TABLE + seed pour les motifs. Pas de FK sur `points_ledger` : le motif est une UI-helper qui pré-remplit les champs existants `reason` et `pillar`. Nouvelles server functions dans `point-reasons.functions.ts`. Mise à jour de `points.tsx` pour intégrer le sélecteur + un nouvel onglet "Motifs" de gestion.

**Tech Stack :** Supabase PostgreSQL, TanStack Start server functions, Zod, React 19, Tailwind CSS v4 (design brutalist Paladium violet).

## Global Constraints

- `bun run typecheck` : 0 erreurs après chaque tâche
- `bun run build:ci` : succès après la tâche finale
- Aucune modification de l'auth, des sessions, des routes protégées existantes
- Permission utilisée : `"points.manage"` (déjà définie)
- Design system : composants `PageCard`, `SectionLabel`, `DaButton`, `DaInput`, `DaSelect`, `EmptyBlock` depuis `@/components/tools/ToolsUi` — `DaButton` n'a PAS de prop `size`
- Piliers valides : `discord_activity` | `ig_investment` | `global_investment`
- Le trigger `trg_sync_member_points` ne se déclenche que sur INSERT dans `points_ledger` — un TRUNCATE nécessite donc un UPDATE manuel de `members.astik_points`
- `point_reasons` : pas de FK sur `points_ledger` (le motif pré-remplit les champs UI seulement)
- Annulations (`reversal`) : mécanisme existant inchangé

---

### Task 1: Migration SQL — table point_reasons + types TS

**Files :**

- Create : `supabase/migrations/20260629000011_point_reasons.sql`
- Modify : `src/integrations/supabase/types.ts` (ajouter `point_reasons` + vérifier aucune autre table touchée)

**Interfaces :**

- Produces : table `point_reasons` avec colonnes `id`, `label`, `pillar`, `active`, `created_at` + seed 5 motifs
- Produces : types TS `point_reasons.Row / Insert / Update` dans `types.ts`

- [ ] **Step 1 : Créer la migration point_reasons**

Créer `supabase/migrations/20260629000011_point_reasons.sql` :

```sql
-- Table des motifs prédéfinis staff.
-- Aucune FK sur points_ledger : le motif est une UI-helper qui pré-remplit
-- reason et pillar dans le formulaire d'attribution.
CREATE TABLE public.point_reasons (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT        NOT NULL,
  pillar     TEXT        NOT NULL
               CHECK (pillar IN ('discord_activity','ig_investment','global_investment')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_reasons_active ON public.point_reasons(active, label);
GRANT ALL ON public.point_reasons TO service_role;
ALTER TABLE public.point_reasons ENABLE ROW LEVEL SECURITY;

-- Seed : motifs de départ
INSERT INTO public.point_reasons (label, pillar) VALUES
  ('Don BDF',           'ig_investment'),
  ('Aide T4',           'global_investment'),
  ('Farm collectif',    'global_investment'),
  ('Activité Discord',  'discord_activity'),
  ('Aide build',        'global_investment');
```

- [ ] **Step 3 : Mettre à jour les types Supabase**

Dans `src/integrations/supabase/types.ts`, localiser le bloc `Tables:` et ajouter `point_reasons` en ordre alphabétique (entre `points_ledger` et la table suivante) :

```typescript
point_reasons: {
  Row: {
    active: boolean;
    created_at: string;
    id: string;
    label: string;
    pillar: string;
  };
  Insert: {
    active?: boolean;
    created_at?: string;
    id?: string;
    label: string;
    pillar: string;
  };
  Update: {
    active?: boolean;
    created_at?: string;
    id?: string;
    label?: string;
    pillar?: string;
  };
  Relationships: [];
};
```

- [ ] **Step 4 : Vérifier le typecheck**

```bash
cd "/Users/hugo/PunkAstik v12 Site/discord-astik-hub"
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 5 : Commiter**

```bash
git add supabase/migrations/20260629000011_point_reasons.sql
git add src/integrations/supabase/types.ts
git commit -m "feat: table point_reasons + seed + types TS"
```

---

### Task 2: Server functions — point_reasons

**Files :**

- Create : `src/lib/data/point-reasons.functions.ts`

**Interfaces :**

- Consumes (Task 1) : table `point_reasons` dans les types Supabase
- Produces :

  ```typescript
  export const getPointReasons: ServerFn → { reasons: PointReasonRow[] }
  // PointReasonRow = { id, label, pillar, active, created_at }
  // Retourne uniquement les raisons actives (active = true) par défaut
  // queryKey suggéré côté UI : ["point-reasons"]

  export const createPointReason: ServerFn({ label, pillar }) → { reason: PointReasonRow }
  // Insère et retourne la ligne créée

  export const togglePointReason: ServerFn({ id }) → { ok: true, active: boolean }
  // Inverse active (true→false ou false→true) et retourne le nouvel état
  ```

- [ ] **Step 1 : Créer `src/lib/data/point-reasons.functions.ts`**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { PILLAR_ZSCHEMA } from "@/lib/data/points-pillars";

export const getPointReasons = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("points.manage");
  const { data, error } = await db
    .from("point_reasons")
    .select("*")
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return { reasons: data ?? [] };
});

export const createPointReason = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        label: z.string().min(1).max(100),
        pillar: PILLAR_ZSCHEMA,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: inserted, error } = await db
      .from("point_reasons")
      .insert({ label: data.label, pillar: data.pillar })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { reason: inserted };
  });

export const togglePointReason = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: current, error: fetchErr } = await db
      .from("point_reasons")
      .select("active")
      .eq("id", data.id)
      .single();
    if (fetchErr || !current) throw new Error("Motif introuvable");
    const { error: updateErr } = await db
      .from("point_reasons")
      .update({ active: !current.active })
      .eq("id", data.id);
    if (updateErr) throw new Error(updateErr.message);
    return { ok: true, active: !current.active };
  });
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commiter**

```bash
git add src/lib/data/point-reasons.functions.ts
git commit -m "feat: point-reasons — getPointReasons, createPointReason, togglePointReason"
```

---

### Task 3: UI — sélecteur motif + onglet "Motifs"

**Files :**

- Modify : `src/routes/_authenticated/points.tsx`

**Interfaces :**

- Consumes (Task 2) :
  - `getPointReasons` → `{ reasons: { id, label, pillar, active, created_at }[] }`
  - `createPointReason({ label, pillar })`
  - `togglePointReason({ id })`
- Consumes (existant) :
  - `PILLAR_OPTIONS` depuis `@/lib/data/points-pillars`
  - `addPoints`, `removePoints`, `setPoints`, `getPointsHistory`, `getPointsPillarSummary`, `reversePointsTransaction` depuis `@/lib/data/points.functions`

**Comportement attendu :**

_Dans ManualPanel :_

- Nouveau champ "Motif" (sélecteur) au-dessus du sélecteur pilier existant
- Options : motifs actifs uniquement (`getPointReasons` filtrés sur active=true), triés par label + une option `""` "— Choisir un motif —" + une option spéciale `"__libre"` "Saisie libre (sans motif)"
- Quand un motif est sélectionné (≠ `""` et ≠ `"__libre"`) :
  - `pillar` est forcé sur la valeur du motif (le `DaSelect` pilier devient désactivé)
  - `reason` est pré-rempli avec le `label` du motif (l'utilisateur peut modifier)
- Quand `"__libre"` est sélectionné : pilier reste libre (comportement actuel), reason vide
- La règle "bouton Add/Remove désactivé si `!pillar`" reste inchangée

_Nouvel onglet "Motifs" :_

- Affiché entre "Par pilier" et "Dons" (ou après "Par pilier" si pas de dons)
- Contenu :
  - Liste des motifs existants (actifs et inactifs) avec badge pilier + bouton "Désactiver" / "Réactiver"
  - Formulaire "Nouveau motif" : `DaInput` label + `DaSelect` pilier + `DaButton` "Créer"
- Pas d'état `target` (motifs sont globaux, pas liés à un membre)

- [ ] **Step 1 : Ajouter les imports nécessaires**

En tête de `src/routes/_authenticated/points.tsx`, ajouter les imports :

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPointReasons,
  createPointReason,
  togglePointReason,
} from "@/lib/data/point-reasons.functions";
```

(Certains imports existent déjà — n'en dupliquer aucun.)

- [ ] **Step 2 : Modifier ManualPanel pour intégrer le sélecteur motif**

Dans `ManualPanel`, ajouter l'état `reasonId` et la query `pointReasons` :

```typescript
const reasonsFn = useServerFn(getPointReasons);
const [reasonId, setReasonId] = useState<string>("");

const pointReasons = useQuery({
  queryKey: ["point-reasons"],
  queryFn: () => reasonsFn({ data: undefined }),
});

const activeReasons = pointReasons.data?.reasons.filter((r) => r.active) ?? [];
```

Ajouter un handler `onReasonChange` qui met à jour `pillar` et `reason` :

```typescript
const handleReasonChange = (val: string) => {
  setReasonId(val);
  if (val === "" || val === "__libre") {
    // pas de pré-remplissage automatique
    if (val === "__libre") {
      setPillar("");
      setReason("");
    }
    return;
  }
  const found = activeReasons.find((r) => r.id === val);
  if (found) {
    setPillar(found.pillar as PointPillar);
    setReason(found.label);
  }
};
```

Dans le JSX du formulaire, insérer le `DaSelect` motif **avant** le sélecteur pilier existant :

```tsx
<div>
  <label
    htmlFor={`${fid}-reason-id`}
    className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
    style={{ fontFamily: "'Space Mono'" }}
  >
    Motif
  </label>
  <DaSelect
    id={`${fid}-reason-id`}
    value={reasonId}
    onChange={(e) => handleReasonChange(e.target.value)}
    className="w-full mt-1"
  >
    <option value="">— Choisir un motif —</option>
    {activeReasons.map((r) => (
      <option key={r.id} value={r.id}>
        {r.label}
      </option>
    ))}
    <option value="__libre">Saisie libre (sans motif)</option>
  </DaSelect>
</div>
```

Sur le `DaSelect` pilier existant, ajouter `disabled={!!reasonId && reasonId !== "__libre"}` pour le verrouiller quand un motif est sélectionné.

La règle de désactivation des boutons Ajouter/Retirer reste `disabled={busy || !pillar}`.

Remettre `reasonId` à `""` dans la fonction `run()` après un succès (en même temps que `setAmount(0)` et `setReason("")`).

- [ ] **Step 3 : Ajouter l'onglet "Motifs" dans PointsPage**

Dans `PointsPage`, ajouter `<TabsTrigger value="reasons">Motifs</TabsTrigger>` et `<TabsContent value="reasons">` avec le composant `ReasonsPanel`.

Ordre des onglets : Actions manuelles → Par pilier → Motifs → Dons (conditionnel).

- [ ] **Step 4 : Créer le composant `ReasonsPanel`**

```tsx
function ReasonsPanel() {
  const qc = useQueryClient();
  const reasonsFn = useServerFn(getPointReasons);
  const createFn = useServerFn(createPointReason);
  const toggleFn = useServerFn(togglePointReason);
  const fid = useId();

  const [newLabel, setNewLabel] = useState("");
  const [newPillar, setNewPillar] = useState<PointPillar | "">("");

  const reasons = useQuery({
    queryKey: ["point-reasons"],
    queryFn: () => reasonsFn({ data: undefined }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["point-reasons"] });

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({ data: { label: newLabel.trim(), pillar: newPillar as PointPillar } }),
    onSuccess: () => {
      toast.success("Motif créé");
      setNewLabel("");
      setNewPillar("");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Motif mis à jour");
      refresh();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>motifs existants</SectionLabel>
        {reasons.data?.reasons.length === 0 && <EmptyBlock label="Aucun motif" />}
        <ul className="divide-y divide-border">
          {reasons.data?.reasons.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`font-medium text-sm ${r.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {r.label}
                </span>
                <span
                  className="text-[9px] border border-primary/40 text-primary px-1 py-0.5 uppercase tracking-widest"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {PILLAR_LABEL[r.pillar] ?? r.pillar}
                </span>
                {!r.active && (
                  <span
                    className="text-[9px] border border-muted-foreground/30 text-muted-foreground px-1 py-0.5 uppercase tracking-widest"
                    style={{ fontFamily: "'Space Mono'" }}
                  >
                    inactif
                  </span>
                )}
              </div>
              <DaButton
                variant="ghost"
                onClick={() => toggleMutation.mutate(r.id)}
                disabled={toggleMutation.isPending}
                className="text-[10px] px-2 py-0.5 whitespace-nowrap"
              >
                {r.active ? "Désactiver" : "Réactiver"}
              </DaButton>
            </li>
          ))}
        </ul>
      </PageCard>

      <PageCard>
        <SectionLabel>nouveau motif</SectionLabel>
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`${fid}-new-label`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Label
            </label>
            <DaInput
              id={`${fid}-new-label`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="ex: Don Raid"
              className="w-full mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`${fid}-new-pillar`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Pilier
            </label>
            <DaSelect
              id={`${fid}-new-pillar`}
              value={newPillar}
              onChange={(e) => setNewPillar(e.target.value as PointPillar | "")}
              className="w-full mt-1"
            >
              <option value="">— Choisir —</option>
              {PILLAR_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </DaSelect>
          </div>
          <DaButton
            variant="success"
            disabled={createMutation.isPending || !newLabel.trim() || !newPillar}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "..." : "+ Créer le motif"}
          </DaButton>
        </div>
      </PageCard>
    </div>
  );
}
```

Note : `PILLAR_LABEL` est défini dans `points.tsx` (déjà présent depuis la tâche précédente). `PILLAR_OPTIONS` doit être importé de `@/lib/data/points-pillars`.

- [ ] **Step 5 : Vérifier le typecheck**

```bash
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 6 : Vérifier le build CI**

```bash
bun run build:ci 2>&1 | tail -3
```

Attendu : `✓ built in X.XXs`

- [ ] **Step 7 : Commiter**

```bash
git add src/routes/_authenticated/points.tsx
git commit -m "feat: points — sélecteur motif pré-remplissant + onglet gestion motifs"
```
