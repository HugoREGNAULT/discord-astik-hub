# Discord Member Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchroniser la table `members` avec la liste Discord des membres portant le rôle `MEMBER_FACTION` (`1503030823174148216`) sur la guild `FACTION` (`1502936959050321953`), via un bouton staff dans la page admin.

**Architecture :** Migration minimale — ajout de `archived_at TIMESTAMPTZ` sur `members` (la colonne `status` existante gère déjà `active`/`former` ; on ajoute uniquement l'horodatage). Nouvelle server function `syncMembersFromDiscord` dans `members-sync.functions.ts` qui appelle `listAllGuildMembers` (déjà implémenté + rate-limit géré via semaphore Discord). Bouton "Resynchroniser" dans `admin.tsx` avec résumé des actions.

**Tech Stack :** Supabase PostgreSQL, TanStack Start server functions, Zod, Discord API (bot token), React 19, Tailwind CSS v4 / design brutalist Paladium.

## Global Constraints

- `bun run typecheck` : 0 erreurs après chaque tâche
- `bun run build:ci` : succès après la tâche finale
- Aucune modification de l'auth, des sessions, des routes protégées existantes
- Permission : `"admin.access"` sur la server function sync
- GUILD : `GUILDS.FACTION = "1502936959050321953"` (depuis `@/lib/discord/constants`)
- ROLE : `ROLES.MEMBER_FACTION = "1503030823174148216"` (depuis `@/lib/discord/constants`)
- Rate limits : `fetchWithRetry` + `{ bucket: "discord" }` + semaphore déjà en place — NE PAS faire d'appels Discord per-member en boucle ; tout passer via `listAllGuildMembers` (pagination unique)
- Archivage = `status = 'former'` + `archived_at = now()` (pas de suppression)
- Réactivation = `status = 'active'` + `archived_at = null` (si un membre archivé retrouve le rôle)
- Nouveaux membres insérés avec `status = 'active'`, `discord_username` et `roles` depuis Discord, autres champs nullable/défaut
- Design system : composants depuis `@/components/tools/ToolsUi` (`PageCard`, `SectionLabel`, `DaButton`) pour la section sync dans admin.tsx ; `DaButton` n'a PAS de prop `size`

---

### Task 1: Migration `archived_at` + types TS

**Files :**

- Create : `supabase/migrations/20260629000020_members_archived_at.sql`
- Modify : `src/integrations/supabase/types.ts` (bloc `members` — ajouter `archived_at: string | null` dans Row/Insert/Update)

**Interfaces :**

- Produces : colonne `archived_at TIMESTAMPTZ | null` sur `members`, reflétée dans les types TS

- [ ] **Step 1 : Créer la migration**

Créer `supabase/migrations/20260629000020_members_archived_at.sql` :

```sql
-- Horodatage d'archivage (distinct de status).
-- La colonne status existante ('active' | 'former') reste la source de vérité
-- pour le filtrage ; archived_at enregistre quand le passage à 'former' a eu
-- lieu lors d'une synchro Discord.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
```

- [ ] **Step 2 : Mettre à jour les types Supabase**

Dans `src/integrations/supabase/types.ts`, localiser le bloc `members` (ligne ~1499) et ajouter `archived_at: string | null` dans `Row` (après `arrival_date` en ordre alphabétique), `archived_at?: string | null` dans `Insert` et `Update` :

```typescript
// Row (après arrival_date):
archived_at: string | null;

// Insert (après arrival_date?):
archived_at?: string | null;

// Update (après arrival_date?):
archived_at?: string | null;
```

- [ ] **Step 3 : Vérifier le typecheck**

```bash
cd "/Users/hugo/PunkAstik v12 Site/discord-astik-hub"
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Commiter**

```bash
git add supabase/migrations/20260629000020_members_archived_at.sql
git add src/integrations/supabase/types.ts
git commit -m "feat: members — colonne archived_at + types TS"
```

---

### Task 2: Server function `syncMembersFromDiscord`

**Files :**

- Create : `src/lib/data/members-sync.functions.ts`

**Interfaces :**

- Consumes :
  - `listAllGuildMembers(guildId)` depuis `@/lib/discord/api.server` — retourne `DiscordGuildMember[]` avec `user.id`, `user.username`, `user.avatar`, `roles[]`
  - `GUILDS`, `ROLES` depuis `@/lib/discord/constants`
  - `db` depuis `@/lib/db.server`
  - `requirePermission` depuis `@/lib/auth/require.server`
  - `logAction` depuis `@/lib/auth/require.server`
- Produces :
  ```typescript
  export const syncMembersFromDiscord: ServerFn →
    { added: number; archived: number; updated: number; reactivated: number }
  ```

**Logique de synchro (à implémenter dans le handler) :**

```
1. Appel Discord : listAllGuildMembers(GUILDS.FACTION)
   → filter membres ayant ROLES.MEMBER_FACTION dans leurs roles
   → Map discord_id → DiscordGuildMember (factionMemberMap)

2. Lecture DB : SELECT discord_id, status FROM members (tous statuts)
   → Map discord_id → { status, archived_at }

3. Pour chaque membre Discord avec le rôle :
   a. Absent de la DB → INSERT (discord_id, discord_username, roles, avatar_url, status='active')
      → counter added++
   b. Présent en DB avec status='former' → UPDATE status='active', archived_at=null, discord_username, roles, avatar_url
      → counter reactivated++
   c. Présent en DB avec status='active' → UPDATE discord_username, roles, avatar_url, updated_at
      → counter updated++

4. Pour chaque membre en DB avec status='active' :
   → Si son discord_id N'EST PAS dans factionMemberMap
   → UPDATE status='former', archived_at=now()
   → counter archived++

5. logAction + return { added, archived, updated, reactivated }
```

- [ ] **Step 1 : Créer `src/lib/data/members-sync.functions.ts`**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { listAllGuildMembers } from "@/lib/discord/api.server";
import { GUILDS, ROLES } from "@/lib/discord/constants";

export const syncMembersFromDiscord = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requirePermission("admin.access");

  // 1. Récupère tous les membres Discord de la guild faction
  const allGuildMembers = await listAllGuildMembers(GUILDS.FACTION);
  const factionMembers = allGuildMembers.filter((m) => m.roles.includes(ROLES.MEMBER_FACTION));
  const factionMap = new Map(factionMembers.filter((m) => m.user?.id).map((m) => [m.user!.id, m]));

  // 2. Lit tous les membres de la DB (actifs et archivés)
  const { data: dbMembers, error: dbErr } = await db
    .from("members")
    .select("discord_id, status, archived_at");
  if (dbErr) throw new Error(dbErr.message);

  const dbMap = new Map((dbMembers ?? []).map((m) => [m.discord_id, m]));

  let added = 0;
  let updated = 0;
  let reactivated = 0;
  let archived = 0;

  // 3. Traite les membres Discord ayant le rôle
  for (const [discordId, gm] of factionMap) {
    const avatarUrl = gm.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${gm.user.avatar}.webp`
      : null;
    const dbRow = dbMap.get(discordId);

    if (!dbRow) {
      // Nouveau membre : INSERT
      await db.from("members").insert({
        discord_id: discordId,
        discord_username: gm.user?.username ?? null,
        roles: gm.roles,
        avatar_url: avatarUrl,
        status: "active",
      });
      added++;
    } else if (dbRow.status === "former") {
      // Réactivation
      await db
        .from("members")
        .update({
          status: "active",
          archived_at: null,
          discord_username: gm.user?.username ?? null,
          roles: gm.roles,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", discordId);
      reactivated++;
    } else {
      // Mise à jour infos Discord
      await db
        .from("members")
        .update({
          discord_username: gm.user?.username ?? null,
          roles: gm.roles,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", discordId);
      updated++;
    }
  }

  // 4. Archive les membres actifs qui n'ont plus le rôle
  for (const dbRow of dbMembers ?? []) {
    if (dbRow.status !== "active") continue;
    if (!factionMap.has(dbRow.discord_id)) {
      await db
        .from("members")
        .update({
          status: "former",
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("discord_id", dbRow.discord_id);
      archived++;
    }
  }

  await logAction("members_sync_discord", user.discordId, {
    added,
    archived,
    updated,
    reactivated,
  });

  return { added, archived, updated, reactivated };
});
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commiter**

```bash
git add src/lib/data/members-sync.functions.ts
git commit -m "feat: syncMembersFromDiscord — synchro rôle MEMBER_FACTION vs table members"
```

---

### Task 3: UI — bouton sync dans admin.tsx

**Files :**

- Modify : `src/routes/_authenticated/admin.tsx`

**Interfaces :**

- Consumes (Task 2) : `syncMembersFromDiscord` depuis `@/lib/data/members-sync.functions`

**Comportement attendu :**

- Nouvelle section "Synchronisation membres" (après les stats existantes dans AdminPage) utilisant `PageCard` + `SectionLabel` de ToolsUi
- Bouton `DaButton variant="primary"` "Resynchroniser les membres" qui appelle `syncMembersFromDiscord` via `useMutation`
- Pendant l'appel : bouton désactivé + texte "Synchronisation…"
- Succès : affiche un résumé inline avec les 4 compteurs (X ajoutés, Y archivés, Z mis à jour, W réactivés) — résumé visible jusqu'au prochain clic
- Erreur : `toast.error`

- [ ] **Step 1 : Ajouter l'import et la section dans `admin.tsx`**

En tête de `admin.tsx`, ajouter les imports :

```typescript
import { syncMembersFromDiscord } from "@/lib/data/members-sync.functions";
import { PageCard, SectionLabel, DaButton } from "@/components/tools/ToolsUi";
```

(Vérifier qu'il n'y a pas de doublon avec les imports existants.)

Dans `AdminPage`, ajouter le composant `<SyncPanel />` à la fin du JSX, après les sections existantes.

- [ ] **Step 2 : Créer le composant `SyncPanel`**

```tsx
function SyncPanel() {
  const syncFn = useServerFn(syncMembersFromDiscord);
  const qc = useQueryClient();
  const [result, setResult] = useState<{
    added: number;
    archived: number;
    updated: number;
    reactivated: number;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () => syncFn({ data: undefined }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("Synchronisation terminée");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <PageCard>
      <SectionLabel>synchronisation membres</SectionLabel>
      <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "'Space Mono'" }}>
        Compare la table membres avec le rôle Discord{" "}
        <span className="text-primary font-mono">MEMBER_FACTION</span> sur le serveur faction.
        Ajoute les absents, archive ceux qui n'ont plus le rôle, met à jour les pseudos.
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        <DaButton variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Synchronisation…" : "↻ Resynchroniser les membres"}
        </DaButton>
        {result && !mutation.isPending && (
          <div className="flex gap-4 text-sm flex-wrap" style={{ fontFamily: "'Space Mono'" }}>
            <span className="text-emerald-400">+{result.added} ajoutés</span>
            <span className="text-amber-400">⤴ {result.reactivated} réactivés</span>
            <span className="text-sky-400">~ {result.updated} mis à jour</span>
            <span className="text-red-400">✕ {result.archived} archivés</span>
          </div>
        )}
      </div>
    </PageCard>
  );
}
```

- [ ] **Step 3 : Vérifier le typecheck**

```bash
bun run typecheck
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Vérifier le build CI**

```bash
bun run build:ci 2>&1 | tail -3
```

Attendu : `✓ built in X.XXs`

- [ ] **Step 5 : Commiter**

```bash
git add src/routes/_authenticated/admin.tsx
git commit -m "feat: admin — bouton Resynchroniser les membres Discord"
```
