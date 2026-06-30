# Points Pillars — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un champ `pillar` (3 valeurs : discord_activity | ig_investment | global_investment) à chaque transaction de points, et exposer dans la page `/points` existante un onglet "Par pilier" avec résumé par pilier, historique filtré et annulation de transaction.

**Architecture:** Migration SQL minimale (colonne nullable sur `points_ledger`) + mise à jour des types Supabase générés. Les fonctions serveur `addPoints`/`removePoints` deviennent obligatoirement pilier-aware. Deux nouvelles fonctions : `getPointsPillarSummary` et `reversePointsTransaction`. L'UI intègre un sélecteur pilier dans le formulaire existant et ajoute un onglet "Par pilier" dans la page `/points`.

**Tech Stack:** Supabase PostgreSQL, TanStack Start server functions, Zod, React 19, Tailwind CSS v4 (design system brutalist violet en place).

## Global Constraints

- `bun run typecheck` (= `tsc --noEmit`) doit passer à 0 erreurs après chaque tâche
- `bun run build:ci` doit passer après la tâche finale
- Aucune modification de l'auth, des sessions, des routes protégées existantes
- Permission utilisée : `"points.manage"` (déjà définie dans `src/lib/auth/permissions.ts`)
- Design system : composants `PageCard`, `SectionLabel`, `DaButton`, `DaInput`, `DaSelect`, `EmptyBlock` depuis `@/components/tools/ToolsUi`
- Piliers valides (valeurs exactes) : `discord_activity`, `ig_investment`, `global_investment`
- Labels FR : `discord_activity` → `"Activité Discord"`, `ig_investment` → `"Investissement IG"`, `global_investment` → `"Investissement Global"`
- Annulation = insertion d'une transaction inverse (`action_type: "reversal"`, `amount: -original.amount`), jamais de suppression
- La colonne `pillar` est nullable en base (anciennes lignes = `null`) mais obligatoire dans le formulaire UI pour toute nouvelle attribution

---

### Task 1: Migration SQL + mise à jour des types Supabase

**Files:**

- Create: `supabase/migrations/20260629000001_points_ledger_pillar.sql`
- Modify: `src/integrations/supabase/types.ts` (lignes 2113–2165 : `points_ledger` Row/Insert/Update)

**Interfaces:**

- Produces: colonne `pillar TEXT | null` dans la table `points_ledger`, reflétée dans les types TS

- [ ] **Step 1: Créer le fichier de migration**

Créer `/Users/hugo/PunkAstik v12 Site/discord-astik-hub/supabase/migrations/20260629000001_points_ledger_pillar.sql` avec le contenu suivant :

```sql
-- Ajoute la colonne pilier sur points_ledger.
-- Nullable : les lignes historiques restent valides (pillar = NULL = non catégorisé).
ALTER TABLE public.points_ledger
  ADD COLUMN IF NOT EXISTS pillar TEXT
    CHECK (pillar IN ('discord_activity', 'ig_investment', 'global_investment'));

CREATE INDEX IF NOT EXISTS idx_points_ledger_pillar
  ON public.points_ledger(member_discord_id, pillar)
  WHERE pillar IS NOT NULL;
```

- [ ] **Step 2: Mettre à jour les types Supabase générés**

Dans `src/integrations/supabase/types.ts`, localiser le bloc `points_ledger` (autour de la ligne 2113) et ajouter `pillar: string | null` dans `Row`, `Insert`, et `Update` :

```typescript
// Row (ligne ~2114) — ajouter APRÈS total_after:
pillar: string | null;

// Insert (ligne ~2126) — ajouter APRÈS total_after:
pillar?: string | null;

// Update (ligne ~2138) — ajouter APRÈS total_after?:
pillar?: string | null;
```

Le résultat final pour le bloc `Row` doit être :

```typescript
Row: {
  action_type: string;
  amount: number;
  bonus_pct: number | null;
  created_at: string;
  id: string;
  member_discord_id: string;
  pillar: string | null;
  reason: string | null;
  staff_discord_id: string;
  staff_username: string | null;
  total_after: number;
}
```

Pour `Insert` :

```typescript
Insert: {
  action_type: string;
  amount: number;
  bonus_pct?: number | null;
  created_at?: string;
  id?: string;
  member_discord_id: string;
  pillar?: string | null;
  reason?: string | null;
  staff_discord_id: string;
  staff_username?: string | null;
  total_after: number;
};
```

Pour `Update` :

```typescript
Update: {
  action_type?: string;
  amount?: number;
  bonus_pct?: number | null;
  created_at?: string;
  id?: string;
  member_discord_id?: string;
  pillar?: string | null;
  reason?: string | null;
  staff_discord_id?: string;
  staff_username?: string | null;
  total_after?: number;
};
```

- [ ] **Step 3: Vérifier le typecheck**

```bash
cd "/Users/hugo/PunkAstik v12 Site/discord-astik-hub"
bun run typecheck
```

Attendu : sortie vide (0 erreurs).

- [ ] **Step 4: Commiter**

```bash
git add supabase/migrations/20260629000001_points_ledger_pillar.sql
git add src/integrations/supabase/types.ts
git commit -m "feat: points_ledger — colonne pillar nullable + types TS"
```

---

### Task 2: Constantes piliers + fonctions serveur

**Files:**

- Create: `src/lib/data/points-pillars.ts`
- Modify: `src/lib/data/points.functions.ts`

**Interfaces:**

- Produces (depuis `points-pillars.ts`) :
  ```typescript
  export const PILLAR_OPTIONS: readonly { value: PointPillar; label: string }[]
  export type PointPillar = 'discord_activity' | 'ig_investment' | 'global_investment'
  export const PILLAR_ZSCHEMA: z.ZodEnum<[...]>
  ```
- Produces (depuis `points.functions.ts`) :
  - `addPoints` — input étendu avec `pillar: PointPillar` (requis)
  - `removePoints` — input étendu avec `pillar: PointPillar` (requis)
  - `getPointsPillarSummary({ memberDiscordId })` → `{ summary: { discord_activity: number; ig_investment: number; global_investment: number; uncategorized: number } }`
  - `reversePointsTransaction({ ledgerId, reason })` → `{ ok: true; total: number }`
- Consumes (Task 1) : colonne `pillar` dans `points_ledger` type

- [ ] **Step 1: Créer `src/lib/data/points-pillars.ts`**

```typescript
import { z } from "zod";

export const PILLAR_OPTIONS = [
  { value: "discord_activity" as const, label: "Activité Discord" },
  { value: "ig_investment" as const, label: "Investissement IG" },
  { value: "global_investment" as const, label: "Investissement Global" },
] as const;

export type PointPillar = (typeof PILLAR_OPTIONS)[number]["value"];

export const PILLAR_ZSCHEMA = z.enum(["discord_activity", "ig_investment", "global_investment"]);
```

- [ ] **Step 2: Modifier `addPoints` dans `points.functions.ts`**

Ajouter l'import en tête du fichier :

```typescript
import { PILLAR_ZSCHEMA, type PointPillar } from "@/lib/data/points-pillars";
```

Modifier le validator de `addPoints` pour ajouter `pillar` requis :

```typescript
export const addPoints = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        amount: z.number().int().min(-MAX_POINTS_PER_OP).max(MAX_POINTS_PER_OP),
        reason: z.string().max(500).optional(),
        bonusPct: z.number().min(0).max(500).default(0),
        pillar: PILLAR_ZSCHEMA,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const bonusMultiplier = 1 + (data.bonusPct ?? 0) / 100;
    const finalAmount = Math.round(data.amount * bonusMultiplier);
    const { total } = await applyDelta(data.memberDiscordId, finalAmount, data.bonusPct);
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: finalAmount,
      reason: data.reason,
      bonus_pct: data.bonusPct,
      total_after: total,
      action_type: "add",
      pillar: data.pillar,
    });
    await logAction("points_add", user.discordId, { ...data, total });
    return { ok: true, total };
  });
```

- [ ] **Step 3: Modifier `removePoints` dans `points.functions.ts`**

Modifier le validator de `removePoints` pour ajouter `pillar` requis :

```typescript
export const removePoints = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1),
        amount: z.number().int().positive().max(MAX_POINTS_PER_OP),
        reason: z.string().max(500).optional(),
        pillar: PILLAR_ZSCHEMA,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { realDelta, total } = await applyDelta(data.memberDiscordId, -data.amount, 0);
    await db.from("points_ledger").insert({
      member_discord_id: data.memberDiscordId,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: realDelta,
      reason: data.reason,
      bonus_pct: 0,
      total_after: total,
      action_type: "remove",
      pillar: data.pillar,
    });
    await logAction("points_remove", user.discordId, { ...data, total });
    return { ok: true, total };
  });
```

- [ ] **Step 4: Ajouter `getPointsPillarSummary` à la fin de `points.functions.ts`**

```typescript
export const getPointsPillarSummary = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ memberDiscordId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: rows, error } = await db
      .from("points_ledger")
      .select("pillar, amount")
      .eq("member_discord_id", data.memberDiscordId);
    if (error) throw new Error(error.message);
    const summary = {
      discord_activity: 0,
      ig_investment: 0,
      global_investment: 0,
      uncategorized: 0,
    };
    for (const row of rows ?? []) {
      const key = (row.pillar ?? "uncategorized") as keyof typeof summary;
      summary[key] = (summary[key] ?? 0) + row.amount;
    }
    return { summary };
  });
```

- [ ] **Step 5: Ajouter `reversePointsTransaction` à la fin de `points.functions.ts`**

```typescript
export const reversePointsTransaction = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        ledgerId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("points.manage");
    const { data: original, error: fetchErr } = await db
      .from("points_ledger")
      .select("*")
      .eq("id", data.ledgerId)
      .single();
    if (fetchErr || !original) throw new Error("Transaction introuvable");
    if (original.action_type === "reversal") throw new Error("Impossible d'annuler une annulation");
    const reverseAmount = -original.amount;
    const { realDelta, total } = await applyDelta(original.member_discord_id, reverseAmount, 0);
    await db.from("points_ledger").insert({
      member_discord_id: original.member_discord_id,
      staff_discord_id: user.discordId,
      staff_username: user.username,
      amount: realDelta,
      reason: data.reason,
      bonus_pct: 0,
      total_after: total,
      action_type: "reversal",
      pillar: original.pillar,
    });
    await logAction("points_reversal", user.discordId, {
      ledgerId: data.ledgerId,
      reason: data.reason,
    });
    return { ok: true, total };
  });
```

- [ ] **Step 6: Vérifier le typecheck**

```bash
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 7: Commiter**

```bash
git add src/lib/data/points-pillars.ts src/lib/data/points.functions.ts
git commit -m "feat: points — pillar sur addPoints/removePoints + getPointsPillarSummary + reversePointsTransaction"
```

---

### Task 3: UI — sélecteur pilier + onglet "Par pilier"

**Files:**

- Modify: `src/routes/_authenticated/points.tsx`

**Interfaces:**

- Consumes (Task 2) :
  - `PILLAR_OPTIONS`, `type PointPillar` depuis `@/lib/data/points-pillars`
  - `getPointsPillarSummary`, `reversePointsTransaction` depuis `@/lib/data/points.functions`
  - `addPoints` et `removePoints` acceptent désormais `pillar: PointPillar` (requis)

**Comportement attendu :**

- Le sélecteur de pilier est obligatoire pour "Ajouter" et "Retirer" (le bouton est désactivé si pilier non sélectionné). Il n'apparaît pas pour "Définir" (setPoints reste sans pilier).
- L'onglet "Par pilier" s'affiche toujours (pas conditionnel), à droite de "Actions manuelles".
- Dans l'onglet "Par pilier" : le membre sélectionné est partagé avec l'onglet "Actions manuelles" (état `target` remonté dans `PointsPage`).
- Résumé : 3 cartes (une par pilier) + 1 carte "Non catégorisé".
- Historique : même liste que ManualPanel, avec badge pilier sur chaque ligne + bouton "Annuler" (s'ouvre en inline form avec champ raison + bouton confirmer).
- Un `reversal` dans l'historique affiche un badge "annulation" et n'a pas de bouton "Annuler".

- [ ] **Step 1: Réécrire `src/routes/_authenticated/points.tsx`**

Remplacer entièrement le contenu du fichier par :

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useId } from "react";

import { listMembers } from "@/lib/data/members.functions";
import {
  addPoints,
  removePoints,
  setPoints,
  getPointsHistory,
  getPointsPillarSummary,
  reversePointsTransaction,
} from "@/lib/data/points.functions";
import { PILLAR_OPTIONS, type PointPillar } from "@/lib/data/points-pillars";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import {
  PageHeader,
  PageCard,
  SectionLabel,
  DaButton,
  DaInput,
  DaSelect,
  EmptyBlock,
} from "@/components/tools/ToolsUi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DonationsPanel } from "@/components/DonationsPanel";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({ meta: [{ title: "Gestion Points · PunkAstik" }] }),
  component: () => (
    <Guard perm="points.manage">
      <PointsPage />
    </Guard>
  ),
});

// Labels des piliers pour l'affichage
const PILLAR_LABEL: Record<string, string> = {
  discord_activity: "Activité Discord",
  ig_investment: "Investissement IG",
  global_investment: "Investissement Global",
};

function PointsPage() {
  const { data: me } = useCurrentUser();
  const canDonations = hasPerm(me, "donations.manage");
  // État membre partagé entre les deux onglets points
  const [target, setTarget] = useState<string>("");

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        code="// points.manage"
        title="Gestion Points"
        description="Ajustements manuels du solde et paniers de dons regroupés au même endroit."
      />
      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Actions manuelles</TabsTrigger>
          <TabsTrigger value="pillars">Par pilier</TabsTrigger>
          {canDonations && <TabsTrigger value="donations">Dons</TabsTrigger>}
        </TabsList>
        <TabsContent value="manual" className="mt-4">
          <ManualPanel target={target} setTarget={setTarget} />
        </TabsContent>
        <TabsContent value="pillars" className="mt-4">
          <PillarsPanel target={target} setTarget={setTarget} />
        </TabsContent>
        {canDonations && (
          <TabsContent value="donations" className="mt-4">
            <DonationsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── ManualPanel ────────────────────────────────────────────────────────────

interface PanelProps {
  target: string;
  setTarget: (v: string) => void;
}

function ManualPanel({ target, setTarget }: PanelProps) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMembers);
  const addFn = useServerFn(addPoints);
  const rmFn = useServerFn(removePoints);
  const setFn = useServerFn(setPoints);
  const histFn = useServerFn(getPointsHistory);
  const fid = useId();

  const members = useQuery({
    queryKey: ["members", "", "active"],
    queryFn: () => listFn({ data: {} }),
  });

  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [pillar, setPillar] = useState<PointPillar | "">("");
  const [busy, setBusy] = useState(false);

  const history = useQuery({
    queryKey: ["history", target],
    queryFn: () => histFn({ data: { memberDiscordId: target, limit: 25 } }),
    enabled: !!target,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history", target] });
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["pillar-summary", target] });
  };

  const run = async (action: "add" | "remove" | "set") => {
    if (!target) {
      toast.error("Sélectionne un membre.");
      return;
    }
    if (action !== "set" && amount <= 0) {
      toast.error("Montant > 0 requis.");
      return;
    }
    if (action === "set" && amount < 0) {
      toast.error("Le solde ne peut pas être négatif.");
      return;
    }
    if ((action === "add" || action === "remove") && !pillar) {
      toast.error("Sélectionne un pilier.");
      return;
    }
    setBusy(true);
    try {
      let res: { total: number };
      if (action === "add")
        res = await addFn({
          data: { memberDiscordId: target, amount, reason, pillar: pillar as PointPillar },
        });
      else if (action === "remove")
        res = await rmFn({
          data: { memberDiscordId: target, amount, reason, pillar: pillar as PointPillar },
        });
      else res = await setFn({ data: { memberDiscordId: target, total: amount, reason } });
      toast.success(`OK — nouveau solde : ${res.total} pts`);
      setAmount(0);
      setReason("");
      refresh();
    } catch (e: unknown) {
      toast.error(toUserMessage(e as Error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>action manuelle</SectionLabel>
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`${fid}-member`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Membre
            </label>
            <DaSelect
              id={`${fid}-member`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full mt-1"
            >
              <option value="">— Choisir —</option>
              {members.data?.members.map((m) => (
                <option key={m.discord_id} value={m.discord_id}>
                  {m.ig_name ?? m.discord_username} ({m.astik_points} pts)
                </option>
              ))}
            </DaSelect>
          </div>

          <div>
            <label
              htmlFor={`${fid}-pillar`}
              className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Pilier <span className="text-primary">*</span>
            </label>
            <DaSelect
              id={`${fid}-pillar`}
              value={pillar}
              onChange={(e) => setPillar(e.target.value as PointPillar | "")}
              className="w-full mt-1"
            >
              <option value="">— Choisir un pilier —</option>
              {PILLAR_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </DaSelect>
            <p
              className="text-[10px] text-muted-foreground mt-1"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Requis pour Ajouter / Retirer. Ignoré pour Définir.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${fid}-amount`}
                className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                style={{ fontFamily: "'Space Mono'" }}
              >
                Montant
              </label>
              <DaInput
                id={`${fid}-amount`}
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={`${fid}-reason`}
                className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                style={{ fontFamily: "'Space Mono'" }}
              >
                Raison
              </label>
              <DaInput
                id={`${fid}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ex: don raid base ennemie"
                className="w-full mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            <DaButton variant="success" disabled={busy || !pillar} onClick={() => run("add")}>
              {busy ? "..." : "+ Ajouter"}
            </DaButton>
            <DaButton variant="danger" disabled={busy || !pillar} onClick={() => run("remove")}>
              {busy ? "..." : "− Retirer"}
            </DaButton>
            <DaButton variant="ghost" disabled={busy} onClick={() => run("set")}>
              {busy ? "..." : "= Définir"}
            </DaButton>
          </div>
        </div>
      </PageCard>

      <PageCard>
        <SectionLabel>historique du membre</SectionLabel>
        {!target && <EmptyBlock label="Sélectionne un membre" />}
        {target && history.data?.history && history.data.history.length === 0 && (
          <EmptyBlock label="Aucun mouvement" />
        )}
        {history.data?.history && history.data.history.length > 0 && (
          <ul className="divide-y divide-border">
            {history.data.history.map((e: any) => (
              <LedgerRow key={e.id} entry={e} onReversed={refresh} />
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}

// ─── PillarsPanel ────────────────────────────────────────────────────────────

function PillarsPanel({ target, setTarget }: PanelProps) {
  const listFn = useServerFn(listMembers);
  const summaryFn = useServerFn(getPointsPillarSummary);
  const histFn = useServerFn(getPointsHistory);
  const qc = useQueryClient();
  const fid = useId();

  const members = useQuery({
    queryKey: ["members", "", "active"],
    queryFn: () => listFn({ data: {} }),
  });

  const summary = useQuery({
    queryKey: ["pillar-summary", target],
    queryFn: () => summaryFn({ data: { memberDiscordId: target } }),
    enabled: !!target,
  });

  const history = useQuery({
    queryKey: ["history", target],
    queryFn: () => histFn({ data: { memberDiscordId: target, limit: 50 } }),
    enabled: !!target,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history", target] });
    qc.invalidateQueries({ queryKey: ["pillar-summary", target] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <div className="space-y-5">
      <PageCard>
        <SectionLabel>membre</SectionLabel>
        <DaSelect
          id={`${fid}-p-member`}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full"
        >
          <option value="">— Choisir —</option>
          {members.data?.members.map((m) => (
            <option key={m.discord_id} value={m.discord_id}>
              {m.ig_name ?? m.discord_username} ({m.astik_points} pts)
            </option>
          ))}
        </DaSelect>
      </PageCard>

      {target && summary.data && (
        <PageCard>
          <SectionLabel>répartition par pilier</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {PILLAR_OPTIONS.map((p) => (
              <div key={p.value} className="border-[3px] border-border bg-secondary p-3 space-y-1">
                <div
                  className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  {p.label}
                </div>
                <div
                  className="text-xl font-bold text-primary"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {summary.data.summary[p.value] ?? 0}
                </div>
              </div>
            ))}
            {(summary.data.summary.uncategorized ?? 0) !== 0 && (
              <div className="border-[3px] border-border bg-secondary p-3 space-y-1">
                <div
                  className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground"
                  style={{ fontFamily: "'Space Mono'" }}
                >
                  Non catégorisé
                </div>
                <div
                  className="text-xl font-bold text-muted-foreground"
                  style={{ fontFamily: "'Space Grotesk'" }}
                >
                  {summary.data.summary.uncategorized}
                </div>
              </div>
            )}
          </div>
        </PageCard>
      )}

      <PageCard>
        <SectionLabel>historique détaillé</SectionLabel>
        {!target && <EmptyBlock label="Sélectionne un membre" />}
        {target && history.data?.history && history.data.history.length === 0 && (
          <EmptyBlock label="Aucun mouvement" />
        )}
        {history.data?.history && history.data.history.length > 0 && (
          <ul className="divide-y divide-border">
            {history.data.history.map((e: any) => (
              <LedgerRow key={e.id} entry={e} onReversed={refresh} showPillar />
            ))}
          </ul>
        )}
      </PageCard>
    </div>
  );
}

// ─── LedgerRow (partagé) ─────────────────────────────────────────────────────

interface LedgerRowProps {
  entry: {
    id: string;
    created_at: string;
    staff_username: string | null;
    action_type: string;
    reason: string | null;
    amount: number;
    pillar: string | null;
  };
  onReversed: () => void;
  showPillar?: boolean;
}

function LedgerRow({ entry: e, onReversed, showPillar = false }: LedgerRowProps) {
  const reverseFn = useServerFn(reversePointsTransaction);
  const [open, setOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const isReversal = e.action_type === "reversal";

  const mutation = useMutation({
    mutationFn: () => reverseFn({ data: { ledgerId: e.id, reason: reverseReason } }),
    onSuccess: () => {
      toast.success("Transaction annulée");
      setOpen(false);
      setReverseReason("");
      onReversed();
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });

  return (
    <li className="py-2 space-y-1">
      <div className="flex justify-between text-sm gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
            style={{ fontFamily: "'Space Mono'" }}
          >
            {new Date(e.created_at).toLocaleString("fr-FR")} · {e.staff_username ?? "—"}
          </div>
          <div className="text-foreground flex items-center gap-2 flex-wrap">
            <span className="font-mono text-primary">{e.action_type}</span>
            {showPillar && e.pillar && (
              <span
                className="text-[9px] border border-primary/40 text-primary px-1 py-0.5 uppercase tracking-widest"
                style={{ fontFamily: "'Space Mono'" }}
              >
                {PILLAR_LABEL[e.pillar] ?? e.pillar}
              </span>
            )}
            {isReversal && (
              <span
                className="text-[9px] border border-muted-foreground/40 text-muted-foreground px-1 py-0.5 uppercase tracking-widest"
                style={{ fontFamily: "'Space Mono'" }}
              >
                annulation
              </span>
            )}
            <span className="text-muted-foreground">{e.reason ?? ""}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span
            className={`font-bold whitespace-nowrap ${e.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {e.amount >= 0 ? "+" : ""}
            {e.amount}
          </span>
          {!isReversal && (
            <DaButton
              variant="ghost"
              onClick={() => setOpen((v) => !v)}
              className="text-[10px] px-2 py-0.5"
            >
              Annuler
            </DaButton>
          )}
        </div>
      </div>

      {open && (
        <div className="flex gap-2 items-center pl-2 pt-1">
          <DaInput
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="Raison de l'annulation…"
            className="flex-1 text-sm"
          />
          <DaButton
            variant="danger"
            disabled={mutation.isPending || !reverseReason.trim()}
            onClick={() => mutation.mutate()}
            className="text-[10px] px-2 py-0.5"
          >
            {mutation.isPending ? "..." : "Confirmer"}
          </DaButton>
          <DaButton
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-[10px] px-2 py-0.5"
          >
            ✕
          </DaButton>
        </div>
      )}
    </li>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

```bash
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 3: Vérifier le build CI**

```bash
bun run build:ci 2>&1 | tail -5
```

Attendu : `✓ built in X.XXs`

- [ ] **Step 4: Commiter**

```bash
git add src/routes/_authenticated/points.tsx
git commit -m "feat: points — onglet Par pilier, sélecteur pilier obligatoire, annulation de transaction"
```
