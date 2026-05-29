import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";

function normalizeUuid(id: string): string {
  const stripped = id.replace(/-/g, "");
  if (stripped.length !== 32) return id;
  return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
}

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
    // 1) Try cache (case-insensitive)
    try {
      const { data: cached } = await db
        .from("minecraft_uuid_cache")
        .select("uuid, username")
        .eq("username_lower", data.username.toLowerCase())
        .maybeSingle();
      if (cached?.uuid) {
        // Refresh from Mojang in background but return cache immediately
        fetch(
          `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(data.username)}`,
        )
          .then(async (r) => {
            if (!r.ok) return;
            const j = (await r.json()) as { id: string; name: string };
            await cacheUpsert([{ uuid: normalizeUuid(j.id), username: j.name }]);
          })
          .catch(() => {});
        return { id: cached.uuid, name: cached.username };
      }
    } catch {
      /* ignore */
    }

    // 2) Hit Mojang
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(data.username)}`,
    );
    if (res.status === 204 || res.status === 404) {
      throw new Error(`Pseudo "${data.username}" introuvable sur Mojang`);
    }
    if (!res.ok) {
      throw new Error(`Mojang API ${res.status}`);
    }
    const json = (await res.json()) as { id: string; name: string };
    const id = normalizeUuid(json.id);
    await cacheUpsert([{ uuid: id, username: json.name }]);
    return { id, name: json.name };
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

    // 2) Hit Mojang for the rest
    const fetched: Array<{ uuid: string; username: string }> = [];
    await Promise.all(
      missing.map(async (raw) => {
        const stripped = raw.replace(/-/g, "");
        if (stripped.length !== 32) return;
        try {
          const res = await fetch(
            `https://sessionserver.mojang.com/session/minecraft/profile/${stripped}`,
          );
          if (!res.ok) return;
          const json = (await res.json()) as { id: string; name: string };
          out[raw] = json.name;
          fetched.push({ uuid: raw, username: json.name });
        } catch {
          /* ignore */
        }
      }),
    );

    await cacheUpsert(fetched);
    return out;
  });
