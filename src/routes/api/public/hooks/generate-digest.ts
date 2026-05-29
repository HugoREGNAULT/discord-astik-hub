import { createFileRoute } from "@tanstack/react-router";
import { generateWeeklyDigest } from "@/lib/data/digest.server";

/**
 * Hook public déclenché par pg_cron (lundi 10h Europe/Paris).
 * Génère le digest IA de la semaine précédente s'il n'existe pas déjà.
 *
 * Sécurité : la route ne fait QUE lire/écrire en base via service_role et
 * appeler l'AI Gateway côté serveur. Aucune donnée sensible n'est renvoyée.
 */
export const Route = createFileRoute("/api/public/hooks/generate-digest")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await generateWeeklyDigest({ generatedBy: "cron" });
          return Response.json(result);
        } catch (err) {
          console.error("generate-digest failed", err);
          return new Response(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : "unknown",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
