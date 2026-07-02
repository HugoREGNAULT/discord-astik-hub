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
