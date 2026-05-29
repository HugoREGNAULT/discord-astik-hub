# Section privée `/tools` — Outils Paladium (faction only)

Section **protégée par Discord auth** (sous `_authenticated`), réservée aux membres de la faction. Design cohérent avec l'existant (cyberpunk/terminal, Space Grotesk + Space Mono, fond `#0a0a0c`, accents pink/Discord blue, bordures d'angle).

## Structure des routes

Toutes les routes vivent sous `_authenticated/` → redirige vers `/login` si non connecté (gate déjà en place dans `src/routes/_authenticated.tsx`).

```text
src/routes/_authenticated/
├── tools.tsx                  → /tools          (layout + landing avec cards)
├── tools.player.tsx           → /tools/player
├── tools.faction.tsx          → /tools/faction
├── tools.status.tsx           → /tools/status
├── tools.market.tsx           → /tools/market
├── tools.leaderboard.tsx      → /tools/leaderboard
├── tools.clicker.tsx          → /tools/clicker
└── tools.xp-calculator.tsx    → /tools/xp-calculator
```

Chaque route a son propre `head()` (title + description).

Le layout `tools.tsx` rend : header partagé (logo, retour au dashboard, onglets/drawer vers les 7 outils) + `<Outlet />` + footer minimal. S'intègre dans le shell membre existant (sidebar conservée si déjà présent).

## Ajout au menu membre

Ajouter une entrée "Outils Paladium" dans la navigation latérale/principale du dashboard staff (celle de `/`, `/recruitment`, `/pdc`, etc.) — je localise le composant de nav existant et j'y greffe le lien avec une icône Lucide (`Wrench` ou `Hammer`).

## Module API partagé

`src/lib/paladium/api.ts`
- `paladiumFetch(path)` — wrapper `fetch` vers `https://api.paladium.games` avec `Authorization: Bearer ${import.meta.env.VITE_PALADIUM_API_KEY}`, gestion erreurs typée (`PaladiumApiError`).
- `resolveUuid(username)` — appel `api.mojang.com/users/profiles/minecraft/{u}`.
- Helpers : `getPlayerProfile`, `getPlayerJobs`, `getPaladiumProfile`, `getFaction`, `getStatus`, `getMarketItems`, `getMarketItem`, `getLeaderboard`.
- Avatar Crafatar : `https://crafatar.com/avatars/{uuid}?size=128`.

**CORS fallback** : si un endpoint échoue en CORS depuis le navigateur, bascule sur une Edge Function Supabase `paladium-proxy` (créée seulement à ce moment, avec `verify_jwt = false` mais accessible via la session membre côté front).

> Note clé API : `VITE_PALADIUM_API_KEY` est préfixée `VITE_` donc **bundlée côté client (visible)**. C'est conforme à la demande. Si la clé doit rester secrète, dis-le et je bascule tout via Edge Function avec une `PALADIUM_API_KEY` runtime. Je laisse un message d'erreur clair si la variable est absente du build.

## Composants partagés (`src/components/tools/`)

- `ToolsHeader.tsx` — sous-header avec onglets (Player, Faction, Status, …).
- `ToolCard.tsx` — card cliquable (icône, titre, description) pour la landing.
- `SearchInput.tsx` — input thématisé style terminal.
- `LoadingBlock.tsx`, `ErrorBlock.tsx`, `EmptyBlock.tsx`.
- `StatTile.tsx` — tuile chiffrée réutilisable.

## Détails par outil

1. **Landing `/tools`** — grille 7 cards.
2. **Player** — input pseudo → resolve UUID → 3 `useQuery` en parallèle. Affiche avatar, identité (pseudo, faction, grade, argent, niveau, inscription), table métiers (niveau + XP), ClicCoins + RPS.
3. **Faction** — input + bouton "Voir PunkAstik" pré-rempli. Affiche nom, membres, alliances, stats.
4. **Status** — `useQuery` avec `refetchInterval: 60_000`. Grille de serveurs avec pastille online/offline + nb joueurs.
5. **Market** — table compacte, recherche par nom, tri prix asc/desc, clic ligne → drawer détail item (via `/items/{item}`).
6. **Leaderboard** — `Tabs` par catégorie (argent, niveau, …), table rang/pseudo/faction/valeur.
7. **Clicker Optimizer** — récupère profil clicker → pour chaque achat possible calcule `ratio = gain_rps / cout` et `temps = cout / (rps / 1.33)`. Top 10 trié par ratio, #1 mis en évidence. Catalogue bâtiments/améliorations dans `src/lib/paladium/clicker-catalog.ts` (placeholder à compléter si l'API ne le renvoie pas).
8. **XP Calculator** — sélecteur métier, niveau actuel + cible, XP actuelle (optionnel), bonus % (optionnel). Pseudo optionnel pour pré-remplir via `/jobs`. Courbes XP dans `src/lib/paladium/xp-curves.ts` (formule paramétrable, valeurs initiales documentées et faciles à ajuster). Rendement par action dans `xp-rates.ts`. Sortie : XP totale + table ressources/actions à farmer. Toggle Java/Bedrock.

## Gestion d'erreurs

- Joueur introuvable (Mojang 204/404) → "Pseudo inconnu".
- Faction introuvable → message dédié.
- API Paladium 5xx/timeout → bandeau "API Paladium indisponible" + retry.
- Clé API absente → bandeau explicatif.

## Hors scope

- Pas de cache persistant (TanStack Query staleTime 60s).
- Pas de favoris ni d'historique de recherches.
- Pas de comparateur multi-joueurs.

## Question avant d'attaquer

Tu confirmes que je peux greffer le lien "Outils Paladium" dans la nav latérale existante du dashboard membre ? Et OK pour `VITE_PALADIUM_API_KEY` côté client (visible dans le bundle) — sinon je passe tout par Edge Function ?