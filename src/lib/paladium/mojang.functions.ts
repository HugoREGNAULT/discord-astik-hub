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
