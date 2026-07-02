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
