# Unification DA — style "Outils Paladium" partout

## Objectif

Appliquer la direction artistique terminal/cyberpunk (déjà utilisée dans `/tools/*` et sur punkastik.com) à toutes les pages authentifiées de l'app, pour avoir une cohérence visuelle complète.

## La DA en question (référence)

- **Fond** : `zinc-950` / `zinc-900/70` avec `backdrop-blur`
- **Accents** : rose `#ec4899` (pink-500) + blurple `#5865F2` ponctuel
- **Typo** : `Space Mono` UPPERCASE tracking large (`0.2em–0.4em`) pour labels/codes, `Space Grotesk` bold pour titres
- **Bordures** : `border-zinc-800`, nettes, **pas de border-radius** (carré)
- **Marqueurs "code"** : préfixes `// section` et `[NN]` partout
- **Boutons** : pink solid avec `border-b-4 border-black/20`, uppercase tracké
- **Tableaux** : header sticky `bg-zinc-900`, lignes `border-b border-zinc-900`, hover `bg-zinc-900/50`

## Approche

### Phase 1 — Primitives partagées (1 fichier)

Étendre `src/components/tools/ToolsUi.tsx` (déjà fait pour les outils) en **kit DA global** réutilisable hors `/tools` :

- `PageHeader` (code + titre + description) — alias de `ToolHeader`
- `PageCard` — alias de `ToolCard`
- `DataTable` wrapper (header sticky pink/mono)
- `PrimaryButton` / `GhostButton` (style pink + border-b-4)
- `StatTile`, `EmptyBlock`, `LoadingBlock`, `ErrorBlock` (déjà existants)
- `SectionLabel` (`// xxx` en pink mono)

Déplacé vers `src/components/ui/da/` pour clarifier que c'est réutilisable partout, avec ré-export depuis `tools/ToolsUi` pour ne rien casser.

### Phase 2 — Refonte page par page

Appliquer le kit sur chaque route, en gardant **toute la logique métier intacte** (juste le visuel) :

Pages dashboard/admin :
- `dashboard.tsx`, `me.tsx`, `profile.tsx`, `welcome.tsx`
- `members.tsx`, `members.$id.tsx`, `effectif.tsx`, `staff.tsx`
- `points.tsx`, `donations.tsx`, `objectives.tsx`, `absences.tsx`
- `polls.tsx`, `polls.index.tsx`, `polls.$id.tsx`
- `recruitment.tsx`, `blacklist.tsx`, `logs.tsx`, `admin.tsx`, `config.tsx`, `pdc.tsx`

Pour chacune :
1. Remplacer cartes shadcn `Card` → `PageCard`
2. Remplacer titres ad-hoc → `PageHeader` avec code `// xx.yy`
3. Remplacer boutons primaires → style pink mono uppercase
4. Tableaux → style header pink sticky
5. Supprimer border-radius résiduel sur les conteneurs principaux

### Phase 3 — Chrome partagé

- `AppSidebar.tsx` : passer en fond `zinc-950`, items en mono uppercase, accent pink sur item actif
- `__root.tsx` / layouts : vérifier fond global `zinc-950`
- `NotificationBell`, `CommandPalette`, `ThemeToggle` : aligner sur DA

### Phase 4 — Public

- `routes/index.tsx` (punkastik.com home) — déjà à priori dans la DA, vérification rapide
- `candidature.tsx`, `login.tsx`, `legal.tsx`, `forbidden.tsx` : aligner

## Détails techniques

- **Pas de refonte de la logique** : que du JSX/className. Aucun changement de data-flow, server fn, requête, route.
- **Pas de migration de design tokens CSS** : on garde `src/styles.css` tel quel (les classes Tailwind `bg-zinc-*` / `text-pink-*` sont utilisées directement par cohérence avec l'existant outils).
- **shadcn `Card` / `Button`** restent dispos pour les composants tiers (dialogs, dropdowns) mais ne sont plus utilisés directement dans les pages — on passe par le kit DA.
- Build vérifié à la fin de chaque phase.

## Découpage en livraisons

Vu l'ampleur, je propose de livrer en **3 PRs / 3 tours** :

1. **Tour 1** : Phase 1 (kit) + Phase 3 (chrome sidebar) + 5 pages les plus visibles (`dashboard`, `members`, `members.$id`, `donations`, `points`)
2. **Tour 2** : Toutes les autres pages auth (polls, recruitment, blacklist, logs, admin, config, effectif, staff, objectives, absences, pdc, profile, me, welcome)
3. **Tour 3** : Pages publiques + polish (login, candidature, legal, forbidden, NotificationBell, CommandPalette)

## Questions avant de démarrer

1. **OK pour découper en 3 tours** ou tu veux que je tente tout d'un coup (risque de réponse incomplète) ?
2. **`punkastik.com` (home `/`)** : à retoucher aussi ou elle est déjà nickel selon toi ?
3. **Mode clair** : on garde le thème dark forcé (l'app est dark-only de toute façon) ou on supprime carrément `ThemeToggle` ?
