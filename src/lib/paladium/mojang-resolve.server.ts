/**
 * Resolver Mojang centralisé.
 *
 * Mojang blackliste les IPs cloud/serverless (Lovable, Vercel, Fly...). Sans
 * User-Agent, leur WAF répond 403 et le pseudo apparaît "introuvable" en prod
 * alors qu'il l'est en local. Ce helper :
 *  1) tente PlayerDB.co (proxy tiers stable, non bloqué),
 *  2) tombe sur api.minecraftservices.com (endpoint officiel actuel),
 *  3) garde api.mojang.com en dernier recours,
 *  4) ajoute UA + Accept sur tous les appels directs Mojang.
 *
 * Toutes les fonctions serveur qui ont besoin d'un lookup Mojang DOIVENT passer
 * par ce module — pas de fetch direct ailleurs.
 */

import { fetchWithRetry } from "@/lib/http/retry.server";

export const MOJANG_USER_AGENT = "PunkAstik-Site/1.0 (+https://punkastik.com)";

const HEADERS = {
  "User-Agent": MOJANG_USER_AGENT,
  Accept: "application/json",
};

export class MojangNotFoundError extends Error {
  constructor(name: string) {
    super(`Pseudo "${name}" introuvable sur Mojang`);
    this.name = "MojangNotFoundError";
  }
}

export class MojangUnavailableError extends Error {
  constructor(lastStatus = 0) {
    super(
      `Services Mojang temporairement indisponibles${
        lastStatus > 0 ? ` (HTTP ${lastStatus})` : ""
      } — réessaie dans quelques minutes.`,
    );
    this.name = "MojangUnavailableError";
  }
}

export function normalizeUuid(id: string): string {
  const s = id.replace(/-/g, "");
  if (s.length !== 32) return id;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function stripUuid(id: string): string {
  return id.replace(/-/g, "");
}

/**
 * Résout un pseudo Minecraft vers son UUID officiel.
 * Lève MojangNotFoundError si le pseudo n'existe pas, MojangUnavailableError si
 * tous les fournisseurs sont en erreur réseau (NE renvoie jamais null — les
 * appelants peuvent wrapper en try/catch s'ils veulent une valeur null).
 */
export async function fetchMojangProfile(name: string): Promise<{ id: string; name: string }> {
  // 1) PlayerDB — proxy tiers
  try {
    const res = await fetchWithRetry(
      `https://playerdb.co/api/player/minecraft/${encodeURIComponent(name)}`,
      { headers: HEADERS },
      { retries: 2, timeoutMs: 8000 },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        success?: boolean;
        data?: { player?: { username?: string; raw_id?: string } };
      };
      if (body.success && body.data?.player?.raw_id && body.data.player.username) {
        return { id: body.data.player.raw_id, name: body.data.player.username };
      }
      // success:false: PlayerDB confond parfois les pseudos invalides — on
      // laisse Mojang trancher (404 clair) plutôt que de lever ici.
    }
  } catch {
    /* fallthrough */
  }

  // 2) + 3) Mojang direct (avec UA)
  const endpoints = [
    `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodeURIComponent(name)}`,
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
  ];
  let lastStatus = 0;
  for (const url of endpoints) {
    try {
      const res = await fetchWithRetry(url, { headers: HEADERS }, { retries: 2, timeoutMs: 8000 });
      if (res.status === 404 || res.status === 204) throw new MojangNotFoundError(name);
      if (!res.ok) {
        lastStatus = res.status;
        continue;
      }
      const body = (await res.json()) as { id?: string; name?: string };
      if (!body.id || !body.name) {
        lastStatus = res.status;
        continue;
      }
      return { id: body.id, name: body.name };
    } catch (e) {
      if (e instanceof MojangNotFoundError) throw e;
      lastStatus = lastStatus || -1;
    }
  }
  throw new MojangUnavailableError(lastStatus);
}

/**
 * Variante "soft" pour les call-sites qui veulent juste null en cas d'échec
 * (cache background, lookup batch...). Renvoie null pour tout échec, y compris
 * 404 et services down.
 */
export async function fetchMojangProfileOrNull(
  name: string,
): Promise<{ id: string; name: string } | null> {
  try {
    return await fetchMojangProfile(name);
  } catch {
    return null;
  }
}

/**
 * Reverse lookup : UUID → pseudo courant via sessionserver, avec UA.
 * Renvoie null si introuvable ou en erreur.
 */
export async function fetchNameByUuid(uuid: string): Promise<string | null> {
  const stripped = stripUuid(uuid);
  if (stripped.length !== 32) return null;
  try {
    const res = await fetchWithRetry(
      `https://sessionserver.mojang.com/session/minecraft/profile/${stripped}`,
      { headers: HEADERS },
      { retries: 2, timeoutMs: 8000 },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { id?: string; name?: string };
    return json.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Batch pseudo → profil via l'endpoint POST officiel (max 10 par requête).
 * Endpoint Mojang historique avec UA — pas d'équivalent officiel sur
 * api.minecraftservices.com pour le bulk byname.
 */
export async function fetchProfilesByNamesBatch(
  names: string[],
): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < names.length; i += 10) {
    const slice = names.slice(i, i + 10);
    try {
      const res = await fetchWithRetry(
        "https://api.minecraftservices.com/minecraft/profile/lookup/bulk/byname",
        {
          method: "POST",
          headers: { ...HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify(slice),
        },
        { retries: 2, timeoutMs: 10_000 },
      );
      if (res.ok) {
        const arr = (await res.json()) as Array<{ id?: string; name?: string }>;
        for (const p of arr) {
          if (p?.id && p?.name) out.push({ id: p.id, name: p.name });
        }
        continue;
      }
      // Fallback ancien endpoint
      const fallback = await fetchWithRetry(
        "https://api.mojang.com/profiles/minecraft",
        {
          method: "POST",
          headers: { ...HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify(slice),
        },
        { retries: 2, timeoutMs: 10_000 },
      );
      if (fallback.ok) {
        const arr = (await fallback.json()) as Array<{ id?: string; name?: string }>;
        for (const p of arr) {
          if (p?.id && p?.name) out.push({ id: p.id, name: p.name });
        }
      }
    } catch {
      /* lot ignoré */
    }
  }
  return out;
}
