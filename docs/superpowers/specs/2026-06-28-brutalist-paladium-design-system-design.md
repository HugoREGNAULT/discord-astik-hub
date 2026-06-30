# Design System — Brutalist Sombre × Univers Paladium

**Date :** 2026-06-28  
**Scope :** Visuel uniquement — tokens, composants UI partagés, layout. Aucune logique, auth, data ou routes modifiées.

---

## 1. Objectif

Remplacer la direction artistique rouge/rose cyberpunk actuelle par un univers **brutalist sombre × Paladium** : fond charbon violacé, accent unique violet `#8b5cf6`, coins droits, bordures 3 px, ombres dures décalées. Dark mode forcé permanent (suppression du ThemeToggle et du mode clair).

---

## 2. Tokens de design (`src/styles.css`)

### 2.1 Palette

| Token CSS                      | Valeur    | Rôle                          |
| ------------------------------ | --------- | ----------------------------- |
| `--background`                 | `#0d0a13` | Fond global (charbon violacé) |
| `--card`                       | `#161020` | Surface panneau principal     |
| `--popover`                    | `#161020` | Popovers, dropdowns           |
| `--secondary`                  | `#1d1530` | Surface secondaire / hover    |
| `--muted`                      | `#1d1530` | Fond atténué                  |
| `--border`                     | `#2c2140` | Bordures par défaut           |
| `--input`                      | `#1d1530` | Fond input                    |
| `--foreground`                 | `#f3ecff` | Texte principal               |
| `--card-foreground`            | `#f3ecff` | Texte sur surfaces            |
| `--popover-foreground`         | `#f3ecff` | Texte popovers                |
| `--muted-foreground`           | `#9a8fb5` | Texte secondaire              |
| `--secondary-foreground`       | `#f3ecff` | Texte sur secondaire          |
| `--primary`                    | `#8b5cf6` | Accent unique violet          |
| `--primary-foreground`         | `#0d0a13` | Texte sur primaire            |
| `--accent`                     | `#8b5cf6` | Accent (=primary)             |
| `--accent-foreground`          | `#0d0a13` | Texte sur accent              |
| `--ring`                       | `#8b5cf6` | Focus ring                    |
| `--sidebar`                    | `#0a0813` | Fond sidebar                  |
| `--sidebar-foreground`         | `#f3ecff` | Texte sidebar                 |
| `--sidebar-primary`            | `#8b5cf6` | Accent sidebar                |
| `--sidebar-primary-foreground` | `#0d0a13` | Texte sur accent sidebar      |
| `--sidebar-accent`             | `#1d1530` | Hover/actif sidebar           |
| `--sidebar-accent-foreground`  | `#f3ecff` | Texte hover sidebar           |
| `--sidebar-border`             | `#2c2140` | Bordure sidebar               |
| `--sidebar-ring`               | `#8b5cf6` | Focus ring sidebar            |
| `--radius`                     | `0rem`    | Coins droits (inchangé)       |

Tokens sémantiques conservés sans changement : `--destructive`, `--success`, `--warning` (teintes rouge/vert/ambre existantes — états, pas nouvelle couleur d'accent).

### 2.2 Typographie

Inter est ajouté comme import `@fontsource/inter/400.css` et `@fontsource/inter/500.css`.

Convention d'usage (via classes utilitaires, pas de tokens CSS dédiés) :

- **Titres/display** : Space Grotesk 700, `uppercase`, `tracking-tight` (letter-spacing négatif)
- **Labels/données** : Space Mono, `text-xs uppercase tracking-[0.1em]`
- **Corps** : Inter (body par défaut)

### 2.3 Halos radiaux (ambiance globale)

Deux halos radial-gradient violets discrets ajoutés sur `body` via CSS :

```css
background-image:
  radial-gradient(ellipse 60% 40% at 20% 0%, rgba(139, 92, 246, 0.07) 0%, transparent 70%),
  radial-gradient(ellipse 40% 30% at 80% 100%, rgba(139, 92, 246, 0.05) 0%, transparent 70%);
```

### 2.4 Suppression du mode clair

- Supprimer le bloc `html.light` (toute la section override + utility remaps)
- **Ne pas modifier** le script `themeInit` dans `__root.tsx` (préserve le hash CSP) — il lit `localStorage` et démarre dark par défaut, ce qui est correct
- Supprimer le composant `ThemeToggle` du rendu (`src/components/ThemeToggle.tsx` reste dans le repo mais n'est plus rendu nulle part)

---

## 3. Composants UI partagés (`src/components/ui/`)

### 3.1 `card.tsx`

**Changements :**

- Retirer `rounded-xl` → `rounded-none`
- Ajouter `border-[3px] border-border`
- Ajouter `shadow-[5px_5px_0px_#000000]`
- Ajouter un coin équerre violet via classe CSS utilitaire `brutal-corner` définie dans `styles.css` :
  - pseudo-élément `::after` positionné `top-0 right-0`, `3px × 12px` vertical + `12px × 3px` horizontal, `bg-primary`

**Implémentation :** La classe `brutal-corner` est définie en CSS global avec `@layer components`. Le `Card` reçoit `relative overflow-visible` pour que le pseudo soit visible.

### 3.2 `button.tsx`

**Changements :**

- Base : retirer `rounded-md` de toutes les tailles
- Variante `default` (primary) : `bg-primary border-[3px] border-primary shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px]`
- Variante `outline` : `border-[3px] border-primary bg-transparent text-primary hover:bg-primary/10`
- Variante `secondary` : `bg-secondary border-[3px] border-border`
- Transitions respectent `prefers-reduced-motion` (transition conditionnel via `motion-safe:transition-all`)

### 3.3 `badge.tsx`

- Retirer `rounded-md` → pas d'arrondi
- Ajouter `font-mono text-[10px] uppercase tracking-[0.08em]` à la base
- Variante `default` : `bg-primary/20 border border-primary text-primary`
- Variante `outline` : `border border-border text-muted-foreground`
- Variante `secondary` : `bg-secondary border border-border`

### 3.4 `progress.tsx`

**Remplissage rayé XP-style :**

- Track : `h-3 rounded-none bg-muted border-[3px] border-border`
- Indicateur : `repeating-linear-gradient(45deg, #8b5cf6 0px, #8b5cf6 6px, #6d3df0 6px, #6d3df0 12px)`
- Transition de largeur : `motion-safe:transition-all duration-500`

### 3.5 `input.tsx`

- `border-[3px] border-border rounded-none bg-input`
- Focus : `border-primary ring-0 outline-none` (pas de ring diffus — changement de couleur de bordure seulement)

### 3.6 `tabs.tsx`

- `TabsList` : `rounded-none border-b border-border bg-transparent p-0`
- `TabsTrigger` : `rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary`

### 3.7 `dialog.tsx`

- `DialogContent` : `rounded-none border-[3px] border-border shadow-[8px_8px_0px_#000]`

---

## 4. Composants app

### 4.1 `AppSidebar.tsx`

Remplacements :

- `bg-[#0a0a0c]` → `bg-sidebar` (token)
- `border-zinc-800/80` → `border-sidebar-border`
- `bg-zinc-900/80`, `bg-zinc-900` → `bg-sidebar-accent`
- `text-zinc-400`, `text-zinc-500`, `text-zinc-600` → `text-muted-foreground`
- `text-white` → `text-sidebar-foreground`
- Accent bar items (`accentBar`) : toujours `bg-primary` (supprimer la logique `pink` / `blurple`)
- Logo border/glow : `border-primary/40`, `bg-primary/30`
- Hover/logout : `hover:text-primary`

### 4.2 `me.tsx` — bandeau joueurs en ligne

Remplacement du bandeau :

- Icône `<Users>` ronde → carré `8×8px bg-primary animate-pulse rounded-none`
- Classe container : `border-2 border-primary/30 bg-primary/5`

---

## 5. Pages avec styles en dur (one-off)

Après le restyle des tokens + composants partagés, un scan sera effectué sur les routes pour repérer les classes `zinc-*`, `pink-*`, `#5865F2` (blurple Discord), `#0a0a0c`, `rounded-` hardcodées. Elles seront remplacées par les équivalents tokens ou `violet-*`/`purple-*` Tailwind mappés sur `primary`.

Classes à trouver et remplacer :

- `text-pink-500`, `bg-pink-500`, `border-pink-500*` → `text-primary`, `bg-primary`, `border-primary`
- `text-zinc-*`, `bg-zinc-*`, `border-zinc-*` → tokens correspondants
- `bg-[#0a0a0c]` → `bg-background` ou `bg-sidebar`
- `rounded-lg`, `rounded-md` dans du JSX custom (hors composants ui/) → `rounded-none`

---

## 6. Accessibilité et responsive

- Focus visible : `focus-visible:ring-2 focus-visible:ring-primary` conservé sur tous les interactifs
- `prefers-reduced-motion` : les animations (pulse, transitions hover bouton, progress) sont conditionnées à `motion-safe:`
- Layout responsive : aucune modification de la grille ou des breakpoints — uniquement les couleurs, bordures, ombres

---

## 7. Typecheck final

`bun run tsc --noEmit` lancé après tous les changements. Seules les erreurs de types liées aux imports visuels (si ThemeToggle est retiré d'un layout) seront corrigées.

---

## 8. Hors périmètre

- Aucune modification de routes, loaders, queries, mutations, permissions, auth
- `ThemeToggle.tsx` reste dans le repo (non supprimé), juste retiré du rendu
- Les graphiques (Recharts) seront recolorés via leurs props `stroke`/`fill` dans les composants qui les utilisent, pas en modifiant la lib
