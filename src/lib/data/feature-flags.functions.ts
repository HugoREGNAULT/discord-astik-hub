/**
 * Feature flags génériques (clé/valeur booléenne).
 *
 * Lecture : toute session valide (le gating fin de l'audience se fait côté page).
 * Écriture : staff disposant de `members.view` — c'est le même staff qui a accès
 * aux pages de pré-lancement et peut donc décider de les publier / masquer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, "clé invalide");

export const getFeatureFlag = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ key: keySchema }).parse(input))
  .handler(async ({ data }) => {
    await requireSession();
    const { data: row, error } = await db
      .from("feature_flags")
      .select("enabled")
      .eq("key", data.key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { enabled: !!row?.enabled };
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: keySchema, enabled: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");
    const up = await db.from("feature_flags").upsert(
      {
        key: data.key,
        enabled: data.enabled,
        updated_at: new Date().toISOString(),
        updated_by_discord_id: user.discordId,
      },
      { onConflict: "key" },
    );
    if (up.error) throw new Error(up.error.message);
    await logAction("feature_flag_set", user.discordId, {
      key: data.key,
      enabled: data.enabled,
    });
    return { ok: true, enabled: data.enabled };
  });
