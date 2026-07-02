# Explorateur API Paladium brut (admin/logs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page de debug staff (`/logs/api-explorer`) qui appelle un endpoint Paladium GET choisi en formulaire et affiche la réponse JSON brute, le status HTTP et les headers de rate-limit, sans jamais planter sur une erreur.

**Architecture:** Nouvelle permission `paladium.debug` (staff faction) gate une nouvelle route TanStack Start. Le formulaire construit un chemin `/v1/...` à partir d'un catalogue statique d'endpoints, l'envoie à une nouvelle server function qui appelle une variante non-throwing de `fetchPaladium` (refactor non-cassant), et affiche le résultat tel quel (status/headers/corps), y compris les erreurs HTTP Paladium qui restent des réponses "réussies" côté app.

**Tech Stack:** TanStack Start (`createServerFn`), TanStack Router (routes fichiers), TanStack Query (`useMutation`), React, Zod, Vitest, shadcn/ui, Tailwind.

## Global Constraints

- La clé `PALADIUM_API_KEY` ne quitte jamais le serveur — inchangé par rapport à l'existant (spec §3.2).
- Aucune modification du système d'authentification (login/logout, session Discord, cache de rôles) — seule `permissions.ts`/`require.server.ts` reçoit un nouveau `case` additif (spec §2).
- `fetchPaladium` (existant) garde exactement son contrat actuel pour tous ses appelants actuels — aucune régression (spec §3.1).
- Page réservée au staff faction via la permission `paladium.debug` (`isStaffFaction`), gate client (`Guard`) + gate serveur (`requirePermission`, seule source d'autorité) (spec §2).
- Kit UI shadcn (`Card`/`Select`/`Input`/`Badge`/`Button`), cohérent avec `logs.tsx`/`admin.tsx` — pas le kit `Da*` (spec §5).
- 31 endpoints GET listés dans la spec §4.1, aucun endpoint de mutation.
- `bun run typecheck` (`tsc --noEmit`) doit passer en fin d'implémentation (spec §8).

---

### Task 1: Permission `paladium.debug`

**Files:**

- Modify: `src/lib/auth/permissions.ts`
- Test: `src/lib/auth/permissions.test.ts`

**Interfaces:**

- Consumes: `isStaffFaction(user: SessionUser): boolean` (déjà exporté dans ce fichier).
- Produces: `"paladium.debug"` ajouté à l'union `Permission`, `canAccess(user, "paladium.debug")`, inclus dans `listPermissions(user)`. Utilisé par les tâches 4, 5, 6.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/lib/auth/permissions.test.ts`, remplacer le bloc `ALL_PERMISSIONS` (lignes 10-24) par :

```ts
const ALL_PERMISSIONS: Permission[] = [
  "profile.self",
  "members.view",
  "members.edit",
  "notes.view",
  "notes.write",
  "warnings.view",
  "warnings.write",
  "points.manage",
  "donations.manage",
  "config.manage",
  "recruit.access",
  "objectives.edit",
  "quests.manage",
  "shop.manage",
  "paladium.debug",
  "admin.access",
];
```

(Ceci corrige aussi une dérive préexistante : `quests.manage` et `shop.manage` avaient été ajoutés à `permissions.ts` sans être répercutés ici, ce qui fait déjà échouer 3 tests avant ce lot.)

Dans le bloc `describe("edge cases", ...)`, la vérification `STAFF_POINTS → profile.self, members.view, points/donations/config.manage` (lignes 47-58) doit inclure `shop.manage` (accordé via `isStaffPoints`) :

```ts
it("STAFF_POINTS → profile.self, members.view, points/donations/config/shop.manage", () => {
  const u = userWith(ROLES.STAFF_POINTS);
  expect(sorted(listPermissions(u))).toEqual(
    sorted([
      "profile.self",
      "members.view",
      "points.manage",
      "donations.manage",
      "config.manage",
      "shop.manage",
    ]),
  );
});
```

Puis ajouter un nouveau bloc `describe` à la fin du fichier (après `describe("exhaustivité", ...)`) :

```ts
describe("paladium.debug", () => {
  it("STAFF_FACTION → paladium.debug true", () => {
    expect(canAccess(userWith(ROLES.STAFF_FACTION), "paladium.debug")).toBe(true);
  });

  it("HIGH_STAFF_PUBLIC → paladium.debug true (via isHighStaff)", () => {
    expect(canAccess(userWith(ROLES.HIGH_STAFF_PUBLIC), "paladium.debug")).toBe(true);
  });

  it("STAFF_POINTS seul → paladium.debug false", () => {
    expect(canAccess(userWith(ROLES.STAFF_POINTS), "paladium.debug")).toBe(false);
  });

  it("MEMBER_FACTION seul → paladium.debug false", () => {
    expect(canAccess(userWith(ROLES.MEMBER_FACTION), "paladium.debug")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `bun run test:unit -- permissions.test.ts`
Expected: FAIL — `"paladium.debug"` n'est pas assignable au type `Permission` (erreur TS silencieuse à l'exécution : `canAccess` retourne `undefined` pour ce cas, donc `toBe(true)` échoue) et les 3 tests de dérive `quests.manage`/`shop.manage` échouent aussi tant que Step 3 n'est pas fait.

- [ ] **Step 3: Implémenter**

Dans `src/lib/auth/permissions.ts`, modifier l'union `Permission` (lignes 13-28) :

```ts
export type Permission =
  | "profile.self"
  | "members.view"
  | "members.edit"
  | "notes.view"
  | "notes.write"
  | "warnings.view"
  | "warnings.write"
  | "points.manage"
  | "donations.manage"
  | "config.manage"
  | "recruit.access"
  | "objectives.edit"
  | "quests.manage"
  | "shop.manage"
  | "paladium.debug"
  | "admin.access";
```

Dans `canAccess` (switch, lignes 61-93), ajouter le `case` avant `admin.access` :

```ts
    case "shop.manage":
      return isStaffPoints(user);
    case "paladium.debug":
      return isStaffFaction(user);
    case "admin.access":
      return isHighStaff(user);
```

Dans `listPermissions` (tableau `all`, lignes 111-129), ajouter l'entrée avant `"admin.access"` :

```ts
    "quests.manage",
    "shop.manage",
    "paladium.debug",
    "admin.access",
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `bun run test:unit -- permissions.test.ts`
Expected: PASS (14 tests précédents + 4 nouveaux, tous verts)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/permissions.ts src/lib/auth/permissions.test.ts
git commit -m "feat(auth): ajoute la permission paladium.debug (staff faction)"
```

---

### Task 2: `fetchPaladiumRaw` — variante non-throwing de `fetchPaladium`

**Files:**

- Modify: `src/lib/paladium/paladium.server.ts`
- Test: `src/lib/paladium/paladium.server.test.ts` (nouveau)

**Interfaces:**

- Consumes: rien de nouveau — `process.env.PALADIUM_API_KEY`, `fetch` global (comme aujourd'hui).
- Produces: `fetchPaladiumRaw(path: string): Promise<{ status: number; ok: boolean; rate: { limit: number|null; remaining: number|null; reset: number|null }; bodyText: string }>` — ne lève jamais sur une réponse HTTP (2xx-5xx), seulement sur une panne réseau. `fetchPaladium(path)` garde exactement sa signature et son comportement actuels (utilisé par tout le reste du code, inchangé). Utilisé par la tâche 4.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/paladium/paladium.server.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPaladium, fetchPaladiumRaw, PaladiumServerError } from "./paladium.server";

function mockResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("fetchPaladiumRaw", () => {
  const originalEnv = process.env.PALADIUM_API_KEY;

  beforeEach(() => {
    process.env.PALADIUM_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.PALADIUM_API_KEY = originalEnv;
    vi.unstubAllGlobals();
  });

  it("renvoie status/ok/rate/bodyText sur une réponse 200 sans lever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, JSON.stringify({ hello: "world" }), {
          "x-ratelimit-limit": "50",
          "x-ratelimit-remaining": "49",
          "x-ratelimit-reset": "300",
        }),
      ),
    );
    const result = await fetchPaladiumRaw("/v1/status");
    expect(result).toEqual({
      status: 200,
      ok: true,
      rate: { limit: 50, remaining: 49, reset: 300 },
      bodyText: JSON.stringify({ hello: "world" }),
    });
  });

  it("renvoie le corps brut NON tronqué sur une 404, sans lever", async () => {
    const longBody = JSON.stringify({ error: "player not found", detail: "x".repeat(300) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(404, longBody)));
    const result = await fetchPaladiumRaw("/v1/paladium/player/profile/unknown");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.bodyText).toBe(longBody);
    expect(result.bodyText.length).toBeGreaterThan(200);
  });

  it("renvoie rate=null quand les headers sont absents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(200, "{}")));
    const result = await fetchPaladiumRaw("/v1/status");
    expect(result.rate).toEqual({ limit: null, remaining: null, reset: null });
  });

  it("envoie Authorization: Bearer <clé> et Accept: application/json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, "{}"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchPaladiumRaw("/v1/status");
    expect(fetchMock).toHaveBeenCalledWith("https://api.paladium.games/v1/status", {
      headers: { Accept: "application/json", Authorization: "Bearer test-key" },
    });
  });
});

describe("fetchPaladium (contrat existant préservé)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lève PaladiumServerError avec le corps tronqué à 200 caractères sur une erreur", async () => {
    const longBody = "x".repeat(300);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(500, longBody)));
    await expect(fetchPaladium("/v1/status")).rejects.toThrow(PaladiumServerError);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(500, longBody)));
    try {
      await fetchPaladium("/v1/status");
      throw new Error("expected fetchPaladium to throw");
    } catch (e) {
      const err = e as PaladiumServerError;
      expect(err.status).toBe(500);
      expect(err.message).toBe(`Paladium API 500: ${longBody.slice(0, 200)}`);
    }
  });

  it("renvoie data parsé + rate sur une réponse 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockResponse(200, JSON.stringify({ hello: "world" }), { "x-ratelimit-limit": "50" }),
        ),
    );
    const result = await fetchPaladium("/v1/status");
    expect(result.data).toEqual({ hello: "world" });
    expect(result.rate.limit).toBe(50);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `bun run test:unit -- paladium.server.test.ts`
Expected: FAIL avec une erreur du type `"fetchPaladiumRaw" is not exported by "src/lib/paladium/paladium.server.ts"`

- [ ] **Step 3: Implémenter**

Remplacer tout le contenu de `src/lib/paladium/paladium.server.ts` par :

```ts
// Server-only Paladium API helper. Reads PALADIUM_API_KEY from process.env at call time.

const PALADIUM_BASE = "https://api.paladium.games";

/**
 * Convertit un UUID Minecraft (avec ou sans tirets) au format canonique
 * 8-4-4-4-12 attendu par l'API Paladium. Renvoie la valeur telle quelle
 * si elle n'est pas un UUID 32 hex.
 */
export function dashUuid(uuid: string): string {
  const v = uuid.replace(/-/g, "");
  if (v.length !== 32 || !/^[0-9a-fA-F]+$/.test(v)) return uuid;
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}`;
}

export class PaladiumServerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PaladiumServerError";
  }
}

export type PaladiumRate = { limit: number | null; remaining: number | null; reset: number | null };

export type PaladiumFetchResult = {
  data: unknown;
  rate: PaladiumRate;
};

export type PaladiumRawResult = {
  status: number;
  ok: boolean;
  rate: PaladiumRate;
  bodyText: string;
};

function parseRate(headers: Headers): PaladiumRate {
  const num = (v: string | null) => (v == null || v === "" ? null : Number(v));
  return {
    limit: num(headers.get("x-ratelimit-limit")),
    remaining: num(headers.get("x-ratelimit-remaining")),
    reset: num(headers.get("x-ratelimit-reset")),
  };
}

async function requestPaladium(path: string): Promise<PaladiumRawResult> {
  const key = process.env.PALADIUM_API_KEY?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  let res: Response;
  try {
    res = await fetch(`${PALADIUM_BASE}${path}`, { headers });
  } catch (err) {
    throw new PaladiumServerError(
      err instanceof Error ? err.message : "Network error reaching Paladium API",
      0,
    );
  }

  const rate = parseRate(res.headers);
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    /* ignore */
  }
  return { status: res.status, ok: res.ok, rate, bodyText };
}

export async function fetchPaladium(path: string): Promise<PaladiumFetchResult> {
  const result = await requestPaladium(path);
  if (!result.ok) {
    throw new PaladiumServerError(
      `Paladium API ${result.status}${result.bodyText ? `: ${result.bodyText.slice(0, 200)}` : ""}`,
      result.status,
    );
  }
  return { data: JSON.parse(result.bodyText), rate: result.rate };
}

/**
 * Variante brute pour l'explorateur API de debug (staff) : ne lève jamais sur
 * une réponse HTTP, même 4xx/5xx — renvoie toujours status/rate/corps complet
 * (non tronqué) pour affichage tel quel. Seule une panne réseau reste une
 * exception (comme fetchPaladium).
 */
export async function fetchPaladiumRaw(path: string): Promise<PaladiumRawResult> {
  return requestPaladium(path);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `bun run test:unit -- paladium.server.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Vérifier qu'aucun appelant existant n'est cassé**

Run: `bun run test:unit`
Expected: PASS (aucune régression sur les tests existants qui dépendent indirectement de `fetchPaladium`)

- [ ] **Step 6: Commit**

```bash
git add src/lib/paladium/paladium.server.ts src/lib/paladium/paladium.server.test.ts
git commit -m "feat(paladium): ajoute fetchPaladiumRaw, variante non-throwing pour le debug"
```

---

### Task 3: Catalogue des endpoints de l'explorateur

**Files:**

- Create: `src/lib/paladium/explorer-catalog.ts`
- Test: `src/lib/paladium/explorer-catalog.test.ts`

**Interfaces:**

- Consumes: rien (module de données pur).
- Produces: `type ExplorerParamType`, `type ExplorerParam`, `type ExplorerEndpoint`, `LEADERBOARD_ID_SUGGESTIONS: string[]`, `EXPLORER_ENDPOINTS: ExplorerEndpoint[]` (31 entrées), `buildExplorerPath(endpoint: ExplorerEndpoint, values: Record<string,string>): string`, `isExplorerRequestReady(endpoint: ExplorerEndpoint, values: Record<string,string>): boolean`. Utilisé par la tâche 6.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/paladium/explorer-catalog.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  buildExplorerPath,
  EXPLORER_ENDPOINTS,
  isExplorerRequestReady,
  LEADERBOARD_ID_SUGGESTIONS,
} from "./explorer-catalog";

describe("EXPLORER_ENDPOINTS", () => {
  it("contient 31 endpoints", () => {
    expect(EXPLORER_ENDPOINTS.length).toBe(31);
  });

  it("a des ids uniques", () => {
    const ids = EXPLORER_ENDPOINTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque placeholder {param} du path correspond exactement aux params déclarés", () => {
    for (const endpoint of EXPLORER_ENDPOINTS) {
      const placeholders = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const paramNames = endpoint.params.map((p) => p.name);
      expect([...paramNames].sort()).toEqual([...placeholders].sort());
    }
  });

  it("LEADERBOARD_ID_SUGGESTIONS contient les 6 catégories connues", () => {
    expect(LEADERBOARD_ID_SUGGESTIONS).toEqual([
      "money",
      "job.miner",
      "job.farmer",
      "job.hunter",
      "job.alchemist",
      "clicker",
    ]);
  });
});

describe("buildExplorerPath", () => {
  it("substitue un seul paramètre uuid", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "player-jobs")!;
    const path = buildExplorerPath(endpoint, { uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5" });
    expect(path).toBe("/v1/paladium/player/profile/069a79f4-44e9-4726-a5be-fca90e38aaf5/jobs");
  });

  it("substitue deux paramètres (id + page)", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "ranking-leaderboard")!;
    const path = buildExplorerPath(endpoint, { id: "job.miner", page: "2" });
    expect(path).toBe("/v1/paladium/ranking/leaderboard/job.miner/2");
  });

  it("encode les caractères spéciaux d'un nom de faction", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "faction-profile")!;
    const path = buildExplorerPath(endpoint, { name: "Les Punk Astik" });
    expect(path).toBe("/v1/paladium/faction/profile/Les%20Punk%20Astik");
  });

  it("renvoie le path tel quel pour un endpoint sans paramètre", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "status")!;
    expect(buildExplorerPath(endpoint, {})).toBe("/v1/status");
  });
});

describe("isExplorerRequestReady", () => {
  it("false tant qu'un paramètre requis est vide ou blanc", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "player-jobs")!;
    expect(isExplorerRequestReady(endpoint, {})).toBe(false);
    expect(isExplorerRequestReady(endpoint, { uuid: "   " })).toBe(false);
  });

  it("true quand tous les paramètres requis sont remplis", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "player-jobs")!;
    expect(isExplorerRequestReady(endpoint, { uuid: "abc" })).toBe(true);
  });

  it("true immédiatement pour un endpoint sans paramètre", () => {
    const endpoint = EXPLORER_ENDPOINTS.find((e) => e.id === "status")!;
    expect(isExplorerRequestReady(endpoint, {})).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `bun run test:unit -- explorer-catalog.test.ts`
Expected: FAIL — `Cannot find module './explorer-catalog'`

- [ ] **Step 3: Implémenter**

Créer `src/lib/paladium/explorer-catalog.ts` :

```ts
// Catalogue statique des endpoints Paladium exposés par l'explorateur API brut
// (page staff /logs/api-explorer). Données pures, aucune logique serveur ici.

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

const uuidParam = (label = "UUID Minecraft"): ExplorerParam => ({
  name: "uuid",
  type: "uuid",
  label,
  placeholder: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
});

const nameParam = (label: string): ExplorerParam => ({
  name: "name",
  type: "name",
  label,
  placeholder: "NomDeLaFaction",
});

const itemParam = (label: string): ExplorerParam => ({
  name: "item",
  type: "item",
  label,
  placeholder: "diamond_sword",
});

const leaderboardIdParam: ExplorerParam = {
  name: "id",
  type: "leaderboardId",
  label: "Catégorie (id)",
  placeholder: "money",
};

const pageParam: ExplorerParam = {
  name: "page",
  type: "page",
  label: "Page",
  placeholder: "1",
};

export const EXPLORER_ENDPOINTS: ExplorerEndpoint[] = [
  { id: "status", group: "Statut", label: "Statut des services", path: "/v1/status", params: [] },

  {
    id: "player-profile",
    group: "Joueur",
    label: "Profil joueur",
    path: "/v1/paladium/player/profile/{uuidOrUsername}",
    params: [
      {
        name: "uuidOrUsername",
        type: "uuidOrUsername",
        label: "UUID ou pseudo",
        placeholder: "Notch ou 069a79f4-44e9-4726-a5be-fca90e38aaf5",
      },
    ],
  },
  {
    id: "player-friends",
    group: "Joueur",
    label: "Amis du joueur",
    path: "/v1/paladium/player/profile/{uuid}/friends",
    params: [uuidParam()],
  },
  {
    id: "player-jobs",
    group: "Joueur",
    label: "Métiers du joueur",
    path: "/v1/paladium/player/profile/{uuid}/jobs",
    params: [uuidParam()],
  },
  {
    id: "player-mount",
    group: "Joueur",
    label: "Monture du joueur",
    path: "/v1/paladium/player/profile/{uuid}/mount",
    params: [uuidParam()],
  },
  {
    id: "player-pet",
    group: "Joueur",
    label: "Familier du joueur",
    path: "/v1/paladium/player/profile/{uuid}/pet",
    params: [uuidParam()],
  },
  {
    id: "player-clicker",
    group: "Joueur",
    label: "Clicker du joueur",
    path: "/v1/paladium/player/profile/{uuid}/clicker",
    params: [uuidParam()],
  },
  {
    id: "player-games",
    group: "Joueur",
    label: "Jeux du joueur",
    path: "/v1/paladium/player/profile/{uuid}/games",
    params: [uuidParam()],
  },
  {
    id: "player-achievements",
    group: "Joueur",
    label: "Achievements du joueur",
    path: "/v1/paladium/player/profile/{uuid}/achievements",
    params: [uuidParam()],
  },

  {
    id: "faction-leaderboard",
    group: "Faction",
    label: "Leaderboard factions",
    path: "/v1/paladium/faction/leaderboard",
    params: [],
  },
  {
    id: "faction-quest",
    group: "Faction",
    label: "Quête faction",
    path: "/v1/paladium/faction/quest",
    params: [],
  },
  {
    id: "faction-onyourmarks",
    group: "Faction",
    label: "À vos marques",
    path: "/v1/paladium/faction/onyourmarks",
    params: [],
  },
  {
    id: "faction-profile",
    group: "Faction",
    label: "Profil faction",
    path: "/v1/paladium/faction/profile/{name}",
    params: [nameParam("Nom de la faction")],
  },
  {
    id: "faction-players",
    group: "Faction",
    label: "Joueurs de la faction",
    path: "/v1/paladium/faction/profile/{name}/players",
    params: [nameParam("Nom de la faction")],
  },

  {
    id: "ranking-leaderboard",
    group: "Classements",
    label: "Leaderboard (catégorie + page)",
    path: "/v1/paladium/ranking/leaderboard/{id}/{page}",
    params: [leaderboardIdParam, pageParam],
  },
  {
    id: "ranking-position-uuid",
    group: "Classements",
    label: "Position serveur d'un joueur",
    path: "/v1/paladium/ranking/position/{uuid}",
    params: [uuidParam()],
  },
  {
    id: "ranking-position-id-uuid",
    group: "Classements",
    label: "Position d'un joueur dans une catégorie",
    path: "/v1/paladium/ranking/position/{id}/{uuid}",
    params: [leaderboardIdParam, uuidParam()],
  },

  {
    id: "trixium-player",
    group: "Trixium",
    label: "Classement joueurs Trixium",
    path: "/v1/paladium/ranking/trixium/player",
    params: [],
  },
  {
    id: "trixium-player-uuid",
    group: "Trixium",
    label: "Trixium d'un joueur",
    path: "/v1/paladium/ranking/trixium/player/{uuid}",
    params: [uuidParam()],
  },
  {
    id: "trixium-faction",
    group: "Trixium",
    label: "Classement factions Trixium",
    path: "/v1/paladium/ranking/trixium/faction",
    params: [],
  },
  {
    id: "trixium-faction-uuid",
    group: "Trixium",
    label: "Trixium d'une faction",
    path: "/v1/paladium/ranking/trixium/faction/{uuid}",
    params: [uuidParam("UUID de la faction")],
  },

  {
    id: "shop-admin-items",
    group: "Boutique",
    label: "Items boutique admin",
    path: "/v1/paladium/shop/admin/items",
    params: [],
  },
  {
    id: "shop-admin-item",
    group: "Boutique",
    label: "Item boutique admin",
    path: "/v1/paladium/shop/admin/items/{item}",
    params: [itemParam("Item")],
  },
  {
    id: "shop-market-categories",
    group: "Boutique",
    label: "Catégories du market",
    path: "/v1/paladium/shop/market/categories",
    params: [],
  },
  {
    id: "shop-market-items",
    group: "Boutique",
    label: "Items du market",
    path: "/v1/paladium/shop/market/items",
    params: [],
  },
  {
    id: "shop-market-item",
    group: "Boutique",
    label: "Item du market",
    path: "/v1/paladium/shop/market/items/{item}",
    params: [itemParam("Item")],
  },
  {
    id: "shop-market-item-history",
    group: "Boutique",
    label: "Historique d'un item du market",
    path: "/v1/paladium/shop/market/items/{item}/history",
    params: [itemParam("Item")],
  },
  {
    id: "shop-market-player-items",
    group: "Boutique",
    label: "Items en vente d'un joueur",
    path: "/v1/paladium/shop/market/players/{uuid}/items",
    params: [uuidParam()],
  },

  {
    id: "achievements",
    group: "Divers",
    label: "Achievements (liste)",
    path: "/v1/paladium/achievements",
    params: [],
  },
  {
    id: "events",
    group: "Divers",
    label: "Événements",
    path: "/v1/paladium/events",
    params: [],
  },
  {
    id: "events-upcoming",
    group: "Divers",
    label: "Événements à venir",
    path: "/v1/paladium/events/upcoming",
    params: [],
  },
];

export function buildExplorerPath(
  endpoint: ExplorerEndpoint,
  values: Record<string, string>,
): string {
  let path = endpoint.path;
  for (const param of endpoint.params) {
    const raw = (values[param.name] ?? "").trim();
    path = path.replace(`{${param.name}}`, encodeURIComponent(raw));
  }
  return path;
}

export function isExplorerRequestReady(
  endpoint: ExplorerEndpoint,
  values: Record<string, string>,
): boolean {
  return endpoint.params.every((p) => (values[p.name] ?? "").trim().length > 0);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `bun run test:unit -- explorer-catalog.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paladium/explorer-catalog.ts src/lib/paladium/explorer-catalog.test.ts
git commit -m "feat(paladium): catalogue des 31 endpoints pour l'explorateur API"
```

---

### Task 4: Server function `exploreRawPaladiumEndpoint`

**Files:**

- Create: `src/lib/paladium/paladium-explorer.functions.ts`

**Interfaces:**

- Consumes: `requirePermission("paladium.debug")` (Task 1, `@/lib/auth/require.server`), `logAction` (`@/lib/auth/require.server`), `rateLimit` (`@/lib/rate-limit.server`), `fetchPaladiumRaw` (Task 2, `./paladium.server`).
- Produces: server function `exploreRawPaladiumEndpoint` — input `{ path: string }`, retour `{ status: number; ok: boolean; rate: { limit: number|null; remaining: number|null; reset: number|null }; body: string }`. Utilisé par la tâche 6.

Pas de test automatisé dédié : aucune `createServerFn` du projet n'est testée unitairement (elle dépend du runtime de session TanStack Start) — convention existante confirmée sur `logs.functions.ts`, `paladium.functions.ts`. La couverture vient de Task 1 (permission), Task 2 (`fetchPaladiumRaw`), et de la vérification manuelle en Task 7.

- [ ] **Step 1: Créer le fichier**

Créer `src/lib/paladium/paladium-explorer.functions.ts` :

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPaladiumRaw } from "./paladium.server";
import { logAction, requirePermission } from "@/lib/auth/require.server";
import { rateLimit } from "@/lib/rate-limit.server";

// Explorateur API brut (staff) : appelle un chemin Paladium arbitraire (whitelist
// de caractères ci-dessous) et renvoie status/rate/corps tels quels, sans jamais
// lever sur une erreur HTTP Paladium — seule une vraie panne applicative
// (permission, rate-limit local) lève une exception.
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

- [ ] **Step 2: Vérifier la compilation**

Run: `bun run typecheck`
Expected: Aucune nouvelle erreur provenant de ce fichier (les erreurs sur `logs.api-explorer.tsx` sont normales tant que Task 6 n'est pas faite — vérifier spécifiquement l'absence d'erreur sur `paladium-explorer.functions.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/paladium/paladium-explorer.functions.ts
git commit -m "feat(paladium): server function exploreRawPaladiumEndpoint (staff debug)"
```

---

### Task 5: Lien sidebar

**Files:**

- Modify: `src/components/AppSidebar.tsx`

**Interfaces:**

- Consumes: `"paladium.debug"` (Task 1).
- Produces: entrée de navigation visible pour le staff faction.

- [ ] **Step 1: Ajouter l'icône à l'import lucide-react**

Dans `src/components/AppSidebar.tsx`, modifier l'import (lignes 2-20) pour ajouter `Terminal` :

```ts
import {
  UserCircle2,
  Users,
  Coins,
  Settings2,
  ShieldAlert,
  LogOut,
  UserPlus,
  CalendarCheck,
  FileText,
  Ban,
  LayoutDashboard,
  Wrench,
  Bell,
  Trophy,
  Star,
  Activity,
  Hammer,
  Terminal,
} from "lucide-react";
```

- [ ] **Step 2: Ajouter l'item de navigation**

Dans le tableau `SECTIONS`, remplacer le bloc `"// administration"` (lignes 92-98) par :

```ts
  {
    label: "// administration",
    items: [
      { title: "Logs", url: "/logs", icon: FileText, perm: "admin.access" },
      { title: "Explorateur API", url: "/logs/api-explorer", icon: Terminal, perm: "paladium.debug" },
      { title: "Admin", url: "/admin", icon: ShieldAlert, perm: "admin.access" },
    ],
  },
```

- [ ] **Step 3: Vérifier la compilation**

Run: `bun run typecheck`
Expected: Aucune erreur sur `AppSidebar.tsx` (l'erreur sur la route `/logs/api-explorer` inexistante encore est normale — traitée en Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat(sidebar): lien Explorateur API sous Logs (section administration)"
```

---

### Task 6: Page `/logs/api-explorer`

**Files:**

- Create: `src/routes/_authenticated/logs.api-explorer.tsx`

**Interfaces:**

- Consumes:
  - `Guard` (`@/components/Guard`), perm `"paladium.debug"` (Task 1)
  - `PageHeader`, `ErrorBlock` (`@/components/tools/ToolsUi`)
  - `PaladiumRateLimits` (`@/components/tools/PaladiumRateLimits`)
  - `EXPLORER_ENDPOINTS`, `buildExplorerPath`, `isExplorerRequestReady`, `LEADERBOARD_ID_SUGGESTIONS`, types `ExplorerEndpoint`/`ExplorerParam` (Task 3, `@/lib/paladium/explorer-catalog`)
  - `exploreRawPaladiumEndpoint` (Task 4, `@/lib/paladium/paladium-explorer.functions`), retour `{ status, ok, rate, body }`
  - `resolveUuid(username: string): Promise<{ id: string; name: string }>` (`@/lib/paladium/api`, existant)
  - `updateRate(path: string, rate: {limit,remaining,reset}): void` (`@/lib/paladium/rate-limits`, existant)
  - `toUserMessage(e: unknown): string` (`@/lib/errors`, existant)
- Produces: route `/logs/api-explorer`.

Pas de test automatisé (aucun `*.test.tsx` n'existe dans le projet — convention confirmée : les pages sont vérifiées manuellement en dev). Vérification manuelle en Step 2 de cette tâche + Task 7.

- [ ] **Step 1: Créer le fichier de route**

Créer `src/routes/_authenticated/logs.api-explorer.tsx` :

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";

import { Guard } from "@/components/Guard";
import { PageHeader, ErrorBlock } from "@/components/tools/ToolsUi";
import { PaladiumRateLimits } from "@/components/tools/PaladiumRateLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toUserMessage } from "@/lib/errors";
import { resolveUuid } from "@/lib/paladium/api";
import { updateRate } from "@/lib/paladium/rate-limits";
import {
  buildExplorerPath,
  EXPLORER_ENDPOINTS,
  isExplorerRequestReady,
  LEADERBOARD_ID_SUGGESTIONS,
  type ExplorerParam,
} from "@/lib/paladium/explorer-catalog";
import { exploreRawPaladiumEndpoint } from "@/lib/paladium/paladium-explorer.functions";

export const Route = createFileRoute("/_authenticated/logs/api-explorer")({
  head: () => ({ meta: [{ title: "Explorateur API · Logs · PunkAstik" }] }),
  component: () => (
    <Guard perm="paladium.debug">
      <ApiExplorerPage />
    </Guard>
  ),
});

const STATUS_LABELS: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

const ENDPOINT_GROUPS: Array<[string, typeof EXPLORER_ENDPOINTS]> = (() => {
  const map = new Map<string, typeof EXPLORER_ENDPOINTS>();
  for (const e of EXPLORER_ENDPOINTS) {
    if (!map.has(e.group)) map.set(e.group, []);
    map.get(e.group)!.push(e);
  }
  return Array.from(map.entries());
})();

function formatBody(body: string): { text: string; isJson: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(body), null, 2), isJson: true };
  } catch {
    return { text: body, isJson: false };
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier");
  } catch {
    toast.error("Impossible de copier");
  }
}

function StatusBadge({ status }: { status: number }) {
  const cls =
    status >= 200 && status < 300
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status >= 400 && status < 500
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <Badge variant="outline" className={`${cls} text-sm`}>
      {status} {STATUS_LABELS[status] ?? ""}
    </Badge>
  );
}

function RateStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border border-border bg-card p-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="text-sm font-mono">{value ?? "—"}</div>
    </div>
  );
}

function ApiExplorerPage() {
  const exploreFn = useServerFn(exploreRawPaladiumEndpoint);

  const [endpointId, setEndpointId] = useState(EXPLORER_ENDPOINTS[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [resolveInputs, setResolveInputs] = useState<Record<string, string>>({});

  const endpoint = useMemo(
    () => EXPLORER_ENDPOINTS.find((e) => e.id === endpointId) ?? EXPLORER_ENDPOINTS[0],
    [endpointId],
  );
  const path = useMemo(() => buildExplorerPath(endpoint, values), [endpoint, values]);
  const ready = isExplorerRequestReady(endpoint, values);

  const mutation = useMutation({
    mutationFn: (requestPath: string) => exploreFn({ data: { path: requestPath } }),
    onSuccess: (res, requestPath) => updateRate(requestPath, res.rate),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const resolveMutation = useMutation({
    mutationFn: (username: string) => resolveUuid(username),
    onSuccess: (data, username) => {
      setValues((v) => ({ ...v, uuid: data.id }));
      toast.success(`${username} → ${data.id}`);
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  function selectEndpoint(id: string) {
    const next = EXPLORER_ENDPOINTS.find((e) => e.id === id) ?? EXPLORER_ENDPOINTS[0];
    setEndpointId(id);
    const initial: Record<string, string> = {};
    if (next.params.some((p) => p.type === "page")) initial.page = "1";
    setValues(initial);
    setResolveInputs({});
    mutation.reset();
  }

  function setParam(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function renderParamField(param: ExplorerParam) {
    const value = values[param.name] ?? "";

    if (param.type === "leaderboardId") {
      return (
        <div key={param.name}>
          <label className="text-xs text-muted-foreground">{param.label}</label>
          <Input
            list="leaderboard-id-suggestions"
            value={value}
            placeholder={param.placeholder}
            onChange={(e) => setParam(param.name, e.target.value)}
          />
        </div>
      );
    }

    if (param.type === "page") {
      return (
        <div key={param.name}>
          <label className="text-xs text-muted-foreground">{param.label}</label>
          <Input
            type="number"
            min={1}
            value={value}
            placeholder={param.placeholder}
            onChange={(e) => setParam(param.name, e.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={param.name}>
        <label className="text-xs text-muted-foreground">{param.label}</label>
        <Input
          value={value}
          placeholder={param.placeholder}
          onChange={(e) => setParam(param.name, e.target.value)}
        />
        {param.type === "uuid" && (
          <div className="flex gap-2 mt-1.5">
            <Input
              className="flex-1 text-xs h-8"
              placeholder="Résoudre depuis un pseudo…"
              value={resolveInputs[param.name] ?? ""}
              onChange={(e) => setResolveInputs((r) => ({ ...r, [param.name]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!(resolveInputs[param.name] ?? "").trim() || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate((resolveInputs[param.name] ?? "").trim())}
            >
              {resolveMutation.isPending ? "…" : "Résoudre pseudo → UUID"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const response = mutation.data;
  const formatted = response ? formatBody(response.body) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="// api-explorer"
        title="Explorateur API Paladium"
        description="Debug brut : choisis un endpoint, remplis les paramètres, envoie. La réponse JSON exacte de Paladium s'affiche ci-dessous — status HTTP et headers de rate-limit inclus. Réservé au staff faction."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requête</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Endpoint</label>
            <Select value={endpointId} onValueChange={selectEndpoint}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {ENDPOINT_GROUPS.map(([group, endpoints]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {endpoints.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {endpoint.params.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">{endpoint.params.map(renderParamField)}</div>
          )}

          <datalist id="leaderboard-id-suggestions">
            {LEADERBOARD_ID_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3">
            <code className="text-xs font-mono text-muted-foreground break-all">GET {path}</code>
            <Button onClick={() => mutation.mutate(path)} disabled={!ready || mutation.isPending}>
              <Send className="size-4 mr-1.5" />
              {mutation.isPending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {mutation.isError && (
        <ErrorBlock
          message={toUserMessage(mutation.error)}
          hint="Cette erreur vient de l'appli (session, rate-limit local, réseau) — pas de Paladium. Une réponse Paladium (même 404/429) s'affiche normalement dans le bloc Réponse ci-dessous."
        />
      )}

      {response && formatted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3 flex-wrap">
              Réponse
              <StatusBadge status={response.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <RateStat label="Limit" value={response.rate.limit} />
              <RateStat label="Remaining" value={response.rate.remaining} />
              <RateStat label="Reset (s)" value={response.rate.reset} />
            </div>

            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 z-10"
                onClick={() => copyToClipboard(formatted.text)}
              >
                <Copy className="size-3.5 mr-1" /> Copier
              </Button>
              <pre className="text-xs font-mono p-4 pt-12 bg-muted rounded overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
                {formatted.text}
              </pre>
            </div>
            {!formatted.isJson && (
              <p className="text-xs text-muted-foreground">
                Réponse non-JSON — affichée telle quelle.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <PaladiumRateLimits />
    </div>
  );
}
```

- [ ] **Step 2: Vérification manuelle en navigateur**

Run: `bun run dev` (depuis `discord-astik-hub/`), puis dans un navigateur, connecté avec un compte staff faction (rôle `STAFF_FACTION` ou `HIGH_STAFF_PUBLIC`) :

1. Ouvrir `/logs/api-explorer` — la page se charge, endpoint "Statut des services" sélectionné par défaut, bouton **Envoyer** actif immédiatement (aucun paramètre requis).
2. Cliquer **Envoyer** — un badge `200 OK` apparaît avec le JSON brut indenté et le bouton **Copier** fonctionne (toast de confirmation).
3. Sélectionner "Profil joueur" — le champ "UUID ou pseudo" apparaît, bouton Envoyer désactivé tant qu'il est vide.
4. Sélectionner "Métiers du joueur" (paramètre `uuid`) — taper un pseudo connu dans le champ "Résoudre depuis un pseudo…", cliquer **Résoudre pseudo → UUID** — le champ UUID principal se remplit, toast de succès.
5. Envoyer une requête vers un UUID inexistant (ex. `00000000-0000-0000-0000-000000000000`) sur "Profil joueur" — un badge `404` (ou équivalent) apparaît avec le corps d'erreur brut, **sans que la page plante** et sans toast d'erreur (ce n'est pas une erreur applicative).
6. Sélectionner "Leaderboard (catégorie + page)" — vérifier que le champ Catégorie propose les 6 suggestions connues (`money`, `job.miner`, …) via la liste déroulante native, et que Page est pré-rempli à `1`.
7. Vérifier dans `/logs` (autre onglet) qu'une entrée `paladium_debug_call` est apparue avec le chemin appelé.
8. Se déconnecter et se reconnecter avec un compte non-staff (ou vérifier via un compte sans rôle staff faction) — `/logs/api-explorer` affiche "Accès refusé" et le lien "Explorateur API" n'apparaît pas dans la sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/logs.api-explorer.tsx
git commit -m "feat(admin): page Explorateur API Paladium brut (staff faction)"
```

---

### Task 7: Vérification finale

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Suite de tests complète**

Run: `bun run test:unit`
Expected: PASS (aucune régression, tous les nouveaux tests des tâches 1-3 verts)

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: aucune erreur

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: aucune erreur sur les fichiers modifiés/créés

- [ ] **Step 4: Résumé final**

Vérifier la liste des commits du lot (`git log --oneline -8`) : permission → fetchPaladiumRaw → catalogue → server function → sidebar → page → (ce commit de vérification n'en produit pas, rien à committer si tout est déjà commité aux étapes précédentes).
