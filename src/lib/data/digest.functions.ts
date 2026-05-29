import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { generateWeeklyDigest } from "./digest.server";

/**
 * Renvoie le dernier digest IA hebdo enregistré (le plus récent).
 */
export const getLatestDigest = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");
  const { data, error } = await db
    .from("ai_digests")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { digest: data ?? null };
});

/**
 * Génère manuellement le digest de la semaine en cours (lundi → maintenant).
 * Réservé aux rôles avec permission `admin.manage`.
 */
export const generateDigestManually = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requirePermission("admin.access");
  const result = await generateWeeklyDigest({
    generatedBy: `manual:${user.discordId}`,
    force: true,
  });
  return result;
});
