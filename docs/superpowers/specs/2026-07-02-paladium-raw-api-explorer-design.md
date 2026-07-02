# Explorateur API Paladium brut (admin/logs)

**Date :** 2026-07-02
**Scope :** Nouvelle page de debug staff sous `/logs`, nouvelle permission `paladium.debug`, extension non-cassante de l'infra Paladium serveur (`fetchPaladium`). Aucune modification du système d'authentification (login/session Discord).

---

## 1. Objectif

Donner au staff faction un outil de debug qui appelle n'importe quel endpoint Paladium documenté (GET), avec des paramètres saisis en formulaire, et affiche **la réponse JSON brute non transformée**, le status HTTP, et les headers `X-RateLimit-*`, sans jamais planter sur une erreur 404/429/5xx.

## 2. Permission

Nouvelle permission `paladium.debug` dans `src/lib/auth/permissions.ts` :

```ts
case "paladium.debug":
  return isStaffFaction(user);
```

- Ajoutée à l'union `Permission` et à `listPermissions()`.
- Réservée au staff faction (même famille que `members.edit`, `notes.write`, `objectives.edit`, `quests.manage`) — plus large que `admin.access` (haut staff) utilisé par `/logs` et `/admin`.
- Gate client : `<Guard perm="paladium.debug">` sur la nouvelle route.
- Gate serveur (source d'autorité) : `requirePermission("paladium.debug")` dans la nouvelle server function. Le composant `Guard` n'est qu'un confort UX, comme documenté dans `Guard.tsx`.
- Aucune modification de `session.server.ts`, `require.server.ts` (hors ajout du `case` dans le switch existant), du login/logout, ni du cache de rôles Discord.

## 3. Backend

### 3.1 `src/lib/paladium/paladium.server.ts` — factorisation non-cassante

`fetchPaladium` actuel lève une exception sur toute réponse non-`ok` et tronque le corps d'erreur à 200 caractères — inutilisable pour un outil de debug qui doit montrer le corps d'erreur brut en entier, y compris les headers de rate-limit d'une 429.

Refactor :

- Extraire la logique de fetch (headers `Authorization`, parsing des headers `x-ratelimit-*`, lecture du corps) dans une fonction interne partagée.
- `fetchPaladium(path)` (existant, tous les appelants actuels inchangés) : garde exactement son contrat actuel — lève `PaladiumServerError` sur `!res.ok`, avec le corps tronqué à 200 caractères, ne renvoie pas les headers de rate sur erreur. **Comportement identique à aujourd'hui.**
- `fetchPaladiumRaw(path)` (nouveau, exporté) : ne lève **jamais** sur une réponse HTTP (2xx à 5xx) — renvoie toujours :
  ```ts
  {
    status: number;
    ok: boolean;
    rate: {
      limit: number | null;
      remaining: number | null;
      reset: number | null;
    }
    bodyText: string;
  }
  ```
  Lève uniquement sur une vraie panne réseau (le `fetch()` lui-même throw), comme aujourd'hui.

### 3.2 Nouvelle server function — `src/lib/paladium/paladium-explorer.functions.ts`

```ts
export const exploreRawPaladiumEndpoint = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        path: z
          .string()
          .min(1)
          .max(512)
          .regex(/^\/v1\/[A-Za-z0-9\-_./%]+(\?[A-Za-z0-9\-_./%=&]+)?$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("paladium.debug");
    const { ok } = rateLimit(`paladium-explorer:${user.discordId}`, 30, 10000);
    if (!ok) throw new Error("RATE_LIMITED");
    const result = await fetchPaladiumRaw(data.path);
    await logAction("paladium_debug_call", user.discordId, {
      path: data.path,
      status: result.status,
    });
    return { status: result.status, ok: result.ok, rate: result.rate, body: result.bodyText };
  });
```

- Path même regex de validation que `callPaladium` (whitelist de caractères — GET only, pas de risque d'injection de méthode/host).
- Rate-limit applicatif dédié (bucket séparé de celui de `callPaladium`, mêmes seuils 30 req/10s), pour ne pas faire interférer l'explorateur avec les autres pages qui consomment déjà l'API Paladium.
- `logAction` en niveau `info` (pas dans `SENSITIVE_ACTIONS`, donc pas de post Discord) — l'appel apparaît dans `/logs` avec le chemin et le status obtenu, ce qui donne une traçabilité naturelle vu que la page vit juste en dessous dans la sidebar.
- La clé `PALADIUM_API_KEY` reste lue côté serveur uniquement (`process.env`), jamais transmise au client — inchangé par rapport à l'existant.

## 4. Catalogue des endpoints — `src/lib/paladium/explorer-catalog.ts`

Fichier de données pur (pas de code serveur), exportant :

```ts
export type ExplorerParamType =
  | "uuid"
  | "uuidOrUsername"
  | "name"
  | "item"
  | "leaderboardId"
  | "page";

export type ExplorerParam = {
  name: string;
  type: ExplorerParamType;
  label: string;
  placeholder?: string;
};

export type ExplorerEndpoint = {
  id: string;
  group: string;
  label: string;
  path: string;
  params: ExplorerParam[];
};

export const LEADERBOARD_ID_SUGGESTIONS = [
  "money",
  "job.miner",
  "job.farmer",
  "job.hunter",
  "job.alchemist",
  "clicker",
];

export const EXPLORER_ENDPOINTS: ExplorerEndpoint[] = [
  /* 31 entrées, voir §4.1 */
];

export function buildExplorerPath(
  endpoint: ExplorerEndpoint,
  values: Record<string, string>,
): string;
```

`buildExplorerPath` substitue chaque `{param}` du template par `encodeURIComponent(values[param])` et renvoie le chemin final (ex. `/v1/paladium/player/profile/{uuid}` + `{uuid: "1234-..."}` → `/v1/paladium/player/profile/1234-...`).

### 4.1 Liste complète (groupe → endpoint → params)

| Groupe      | Path                                              | Params              |
| ----------- | ------------------------------------------------- | ------------------- |
| Statut      | `/v1/status`                                      | —                   |
| Joueur      | `/v1/paladium/player/profile/{uuidOrUsername}`    | uuidOrUsername      |
| Joueur      | `/v1/paladium/player/profile/{uuid}/friends`      | uuid                |
| Joueur      | `/v1/paladium/player/profile/{uuid}/jobs`         | uuid                |
| Joueur      | `/v1/paladium/player/profile/{uuid}/mount`        | uuid                |
| Joueur      | `/v1/paladium/player/profile/{uuid}/pet`          | uuid                |
| Joueur      | `/v1/paladium/player/profile/{uuid}/clicker`      | uuid                |
| Joueur      | `/v1/paladium/player/profile/{uuid}/games`        | uuid                |
| Joueur      | `/v1/paladium/player/profile/{uuid}/achievements` | uuid                |
| Faction     | `/v1/paladium/faction/leaderboard`                | —                   |
| Faction     | `/v1/paladium/faction/quest`                      | —                   |
| Faction     | `/v1/paladium/faction/onyourmarks`                | —                   |
| Faction     | `/v1/paladium/faction/profile/{name}`             | name                |
| Faction     | `/v1/paladium/faction/profile/{name}/players`     | name                |
| Classements | `/v1/paladium/ranking/leaderboard/{id}/{page}`    | leaderboardId, page |
| Classements | `/v1/paladium/ranking/position/{uuid}`            | uuid                |
| Classements | `/v1/paladium/ranking/position/{id}/{uuid}`       | leaderboardId, uuid |
| Trixium     | `/v1/paladium/ranking/trixium/player`             | —                   |
| Trixium     | `/v1/paladium/ranking/trixium/player/{uuid}`      | uuid                |
| Trixium     | `/v1/paladium/ranking/trixium/faction`            | —                   |
| Trixium     | `/v1/paladium/ranking/trixium/faction/{uuid}`     | uuid                |
| Boutique    | `/v1/paladium/shop/admin/items`                   | —                   |
| Boutique    | `/v1/paladium/shop/admin/items/{item}`            | item                |
| Boutique    | `/v1/paladium/shop/market/categories`             | —                   |
| Boutique    | `/v1/paladium/shop/market/items`                  | —                   |
| Boutique    | `/v1/paladium/shop/market/items/{item}`           | item                |
| Boutique    | `/v1/paladium/shop/market/items/{item}/history`   | item                |
| Boutique    | `/v1/paladium/shop/market/players/{uuid}/items`   | uuid                |
| Divers      | `/v1/paladium/achievements`                       | —                   |
| Divers      | `/v1/paladium/events`                             | —                   |
| Divers      | `/v1/paladium/events/upcoming`                    | —                   |

Note : ce catalogue est indépendant de la table `PALADIUM_ROUTES` (`rate-limits.ts`), qui ne couvre pas tous ces chemins (ex. `mount`, `pet`, `games`, `shop/market/categories`, `ranking/trixium/*` avec un tracé différent du path actuellement câblé). On ne touche pas à `PALADIUM_ROUTES` dans ce lot — l'explorateur affiche toujours les headers de rate-limit renvoyés par la réponse elle-même (fiable, indépendant de la table), et alimente `updateRate()` en best-effort pour les routes déjà connues de la table (mise à jour du dashboard `<PaladiumRateLimits />` quand ça matche, no-op sinon).

## 5. Frontend — `src/routes/_authenticated/logs.api-explorer.tsx`

URL : `/logs/api-explorer`. Kit shadcn (`Card`, `Select`, `Input`, `Badge`, `Button`) — cohérent avec `logs.tsx` / `admin.tsx` / `admin.audit.tsx` (le kit `Da*` brutalist reste réservé aux pages `/tools`, par convention documentée dans `ToolsUi.tsx`).

- `<Guard perm="paladium.debug">` + `<PageHeader code="// api-explorer" title="Explorateur API Paladium" description="..." />`.
- **Carte Requête** :
  - `Select` d'endpoint, groupé visuellement par `group` (`SelectGroup`/`SelectLabel`).
  - Champs dynamiques générés selon `endpoint.params` :
    - `uuid` / `uuidOrUsername` / `name` / `item` : `Input` texte simple.
    - `leaderboardId` : `Input` + `<datalist>` des 6 suggestions connues, texte libre sinon.
    - `page` : `Input type="number" min={1}` par défaut `1`.
    - Pour chaque champ `uuid` (pas `uuidOrUsername`, qui accepte déjà un pseudo directement) : ligne bonus "Résoudre pseudo → UUID" — un `Input` pseudo + `Button` qui appelle `resolveUuid()` (déjà exposé côté client dans `src/lib/paladium/api.ts`, lui-même passant par le server function `resolveMojangUuid`) et remplit le champ `uuid` au succès ; `toast.error` au échec (pseudo introuvable, Mojang indisponible).
  - Aperçu en direct du chemin résolu (`<code>`) et bouton **Envoyer** désactivé tant que les params requis ne sont pas remplis.
- **Carte Réponse** (affichée après le premier envoi) :
  - Badge de statut coloré par plage (2xx vert, 4xx ambre, 5xx/0 rouge) + libellé (`200 OK`, `404 Not Found`…).
  - Ligne rate-limit : Limit / Remaining / Reset extraits de `rate` (tirets si absents — Paladium ne les renvoie pas sur toutes les routes).
  - Bloc `<pre>` monospace, indenté (`JSON.parse` + `JSON.stringify(…, null, 2)` si le corps est du JSON valide, sinon texte brut tel quel avec mention "réponse non-JSON"), scrollable, avec bouton **Copier** (`navigator.clipboard.writeText`).
  - Distinction stricte : un status Paladium ≥ 400 est un **succès applicatif** de notre server function (affiché dans cette carte, jamais une exception) — seules une vraie panne (rate-limit local dépassé, perte réseau, session expirée) déclenchent l'état d'erreur de la mutation (`ErrorBlock` séparé, via `toUserMessage`).
- En bas de page : `<PaladiumRateLimits />` (composant déjà existant) pour visualiser le dashboard partagé des rate-limits, alimenté par les appels de l'explorateur en plus des autres pages.

## 6. Sidebar

`src/components/AppSidebar.tsx`, section `// administration`, juste après "Logs" :

```ts
{ title: "Explorateur API", url: "/logs/api-explorer", icon: Terminal, perm: "paladium.debug" },
```

## 7. Hors périmètre

- Aucune modification du login/logout, de la session Discord, du cache de rôles.
- Aucune modification du comportement existant de `fetchPaladium`/`callPaladium` pour leurs appelants actuels.
- Pas d'extension de `PALADIUM_ROUTES` (table de rate-limit affichée sur `/tools`) à ce lot.
- Endpoints POST/mutation Paladium non couverts (hors périmètre demandé — uniquement les 31 GET listés).

## 8. Vérification

`bun run typecheck` (`tsc --noEmit`) en fin d'implémentation.
