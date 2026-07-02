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
