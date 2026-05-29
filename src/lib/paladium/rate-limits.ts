// Tracks Paladium API rate-limit headers per route template.
// Subscribable store + path → template matcher.

import { useSyncExternalStore } from "react";

export type RateInfo = {
  limit: number | null;
  remaining: number | null;
  resetAt: number | null; // epoch ms when the bucket resets
  updatedAt: number;
};

export type RouteSpec = {
  template: string; // display path, e.g. "/v1/paladium/player/profile/{uuid}"
  match: RegExp; // matches the actual request path
  label: string;
  limit: number; // documented per-window limit
  windowMin: number; // documented window in minutes
};

// Documented routes from the public API docs.
export const PALADIUM_ROUTES: RouteSpec[] = [
  {
    template: "/v1/status",
    match: /^\/v1\/status$/,
    label: "Statut services",
    limit: 600,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/player/profile/{uuid|username}",
    match: /^\/v1\/paladium\/player\/profile\/[^/]+$/,
    label: "Profil joueur",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/player/profile/{uuid}/jobs",
    match: /^\/v1\/paladium\/player\/profile\/[^/]+\/jobs$/,
    label: "Métiers joueur",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/player/profile/{uuid}/clicker",
    match: /^\/v1\/paladium\/player\/profile\/[^/]+\/clicker$/,
    label: "Clicker joueur",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/player/profile/{uuid}/friends",
    match: /^\/v1\/paladium\/player\/profile\/[^/]+\/friends$/,
    label: "Amis joueur",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/player/profile/{uuid}/achievements",
    match: /^\/v1\/paladium\/player\/profile\/[^/]+\/achievements$/,
    label: "Achievements joueur",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/faction/leaderboard",
    match: /^\/v1\/paladium\/faction\/leaderboard$/,
    label: "Leaderboard factions",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/faction/profile/{name}",
    match: /^\/v1\/paladium\/faction\/profile\/[^/]+$/,
    label: "Profil faction",
    limit: 50,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/ranking/leaderboard/{id}/{page}",
    match: /^\/v1\/paladium\/ranking\/leaderboard\/[^/]+\/[^/]+$/,
    label: "Classements",
    limit: 600,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/shop/market/items",
    match: /^\/v1\/paladium\/shop\/market\/items(\?.*)?$/,
    label: "Market — items",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/shop/market/items/{item}",
    match: /^\/v1\/paladium\/shop\/market\/items\/[^/?]+$/,
    label: "Market — item",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/shop/market/players/{uuid}/items",
    match: /^\/v1\/paladium\/shop\/market\/players\/[^/]+\/items$/,
    label: "Market — joueur",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/shop/admin/items",
    match: /^\/v1\/paladium\/shop\/admin\/items(\?.*)?$/,
    label: "Shop admin",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/events",
    match: /^\/v1\/paladium\/events$/,
    label: "Événements",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/events/upcoming",
    match: /^\/v1\/paladium\/events\/upcoming$/,
    label: "Événements à venir",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/faction/onyourmark",
    match: /^\/v1\/paladium\/faction\/onyourmark$/,
    label: "À vos marques",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/faction/quests",
    match: /^\/v1\/paladium\/faction\/quests$/,
    label: "Quêtes faction",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/trixium/leaderboard/players",
    match: /^\/v1\/paladium\/trixium\/leaderboard\/players(\?.*)?$/,
    label: "Trixium — joueurs",
    limit: 300,
    windowMin: 5,
  },
  {
    template: "/v1/paladium/trixium/leaderboard/factions",
    match: /^\/v1\/paladium\/trixium\/leaderboard\/factions(\?.*)?$/,
    label: "Trixium — factions",
    limit: 300,
    windowMin: 5,
  },
];

export function routeFor(path: string): RouteSpec | null {
  return PALADIUM_ROUTES.find((r) => r.match.test(path)) ?? null;
}

type State = Record<string, RateInfo>;
let state: State = {};
const listeners = new Set<() => void>();

export function updateRate(
  path: string,
  rate: { limit: number | null; remaining: number | null; reset: number | null },
) {
  const spec = routeFor(path);
  if (!spec) return;
  const now = Date.now();
  state = {
    ...state,
    [spec.template]: {
      limit: rate.limit ?? spec.limit,
      remaining: rate.remaining,
      resetAt: rate.reset != null ? now + rate.reset * 1000 : null,
      updatedAt: now,
    },
  };
  listeners.forEach((fn) => fn());
}

export function useRateLimits(): State {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}
