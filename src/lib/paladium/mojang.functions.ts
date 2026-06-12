import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession } from "@/lib/auth/require.server";
import { rateLimit } from "@/lib/rate-limit.server";
import {
  fetchMojangProfile,
  fetchNameByUuid,
  normalizeUuid,
  MojangNotFoundError,
} from "@/lib/paladium/mojang-resolve.server";

async function cacheUpsert(entries: Array<{ uuid: string; username: string }>) {
  if (entries.length === 0) return;
  try {
    await db.from("minecraft_uuid_cache").upsert(
      entries.map((e) => ({
        uuid: e.uuid,
        username: e.username,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "uuid" },
    );
  } catch {
    /* ignore cache errors */
  }
}

export const resolveMojangUuid = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        username: z
          .string()
          .min(1)
          .max(32)
          .regex(/^[A-Za-z0-9_]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { ok } = rateLimit(`mojang:${user.discordId}`, 20, 10000);
    if (!ok) throw new Error("RATE_LIMITED");
    // 1) Try cache (case-insensitive)
    try {
      const { data: cached } = await db
        .from("minecraft_uuid_cache")
        .select("uuid, username")
        .eq("username_lower", data.username.toLowerCase())
        .maybeSingle();
      if (cached?.uuid) {
        // Refresh from Mojang in background but return cache immediately
        fetchMojangProfile(data.username)
          .then(async (j) => {
            await cacheUpsert([{ uuid: normalizeUuid(j.id), username: j.name }]);
          })
          .catch(() => {});
        return { id: cached.uuid, name: cached.username };
      }
    } catch {
      /* ignore */
    }

    // 2) Hit Mojang (helper centralisé : PlayerDB → minecraftservices → mojang + UA)
    try {
      const json = await fetchMojangProfile(data.username);
      const id = normalizeUuid(json.id);
      await cacheUpsert([{ uuid: id, username: json.name }]);
      return { id, name: json.name };
    } catch (e) {
      if (e instanceof MojangNotFoundError) {
        throw new Error(`Pseudo "${data.username}" introuvable sur Mojang`);
      }
      throw e;
    }
  });

// Resolve a batch of UUIDs to Minecraft usernames via Mojang sessionserver.
// Returns a map { uuid: name } (uuid normalized with dashes).
export const resolveUuidsToNames = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        uuids: z.array(z.string().min(20).max(40)).min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSession();
    const { ok } = rateLimit(`mojang:${user.discordId}`, 20, 10000);
    if (!ok) throw new Error("RATE_LIMITED");
    const out: Record<string, string> = {};
    const unique = Array.from(new Set(data.uuids.map(normalizeUuid)));

    // 1) Cache lookup
    try {
      const { data: cached } = await db
        .from("minecraft_uuid_cache")
        .select("uuid, username")
        .in("uuid", unique);
      cached?.forEach((r) => {
        out[r.uuid] = r.username;
      });
    } catch {
      /* ignore */
    }

    const missing = unique.filter((u) => !out[u]);
    if (missing.length === 0) return out;

    // 2) Hit Mojang sessionserver for the rest (avec UA via helper)
    const fetched: Array<{ uuid: string; username: string }> = [];
    await Promise.all(
      missing.map(async (raw) => {
        const name = await fetchNameByUuid(raw);
        if (name) {
          out[raw] = name;
          fetched.push({ uuid: raw, username: name });
        }
      }),
    );

    await cacheUpsert(fetched);
    return out;
  });
