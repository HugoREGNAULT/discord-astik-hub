import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    let id = json.id;
    if (id && id.length === 32) {
      id = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    }
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
    const unique = Array.from(new Set(data.uuids));
    await Promise.all(
      unique.map(async (raw) => {
        const stripped = raw.replace(/-/g, "");
        if (stripped.length !== 32) return;
        try {
          const res = await fetch(
            `https://sessionserver.mojang.com/session/minecraft/profile/${stripped}`,
          );
          if (!res.ok) return;
          const json = (await res.json()) as { id: string; name: string };
          out[raw] = json.name;
        } catch {
          /* ignore */
        }
      }),
    );
    return out;
  });
