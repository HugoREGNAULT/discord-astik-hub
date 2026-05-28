/**
 * RGPD : permet à un membre de demander la suppression de ses données.
 * - Supprime les alts, notes, warnings, points_ledger, applications
 * - Anonymise la fiche `members` (statut former, pseudo/avatar effacés)
 * - Détruit la session
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, logAction } from "@/lib/auth/require.server";
import { clearSession } from "@/lib/auth/session.server";

const schema = z.object({
  confirm: z.literal("SUPPRIMER"),
});

export const deleteMyAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async () => {
    const user = await requireSession();
    const id = user.discordId;

    await Promise.all([
      db.from("member_alts").delete().eq("member_discord_id", id),
      db.from("notes").delete().eq("member_discord_id", id),
      db.from("warnings").delete().eq("member_discord_id", id),
      db.from("points_ledger").delete().eq("member_discord_id", id),
      db.from("applications").delete().eq("discord_id", id),
    ]);

    // Anonymise la fiche membre (on garde l'enregistrement pour cohérence des dons/logs)
    await db
      .from("members")
      .update({
        status: "former",
        ig_name: null,
        mc_uuid: null,
        avatar_url: null,
        discord_username: "[supprimé]",
        astik_points: 0,
        messages_7d: 0,
        messages_total: 0,
        voice_7d_seconds: 0,
        voice_total_seconds: 0,
        recruiter_discord_id: null,
      })
      .eq("discord_id", id);

    await logAction("account_deleted_self", id, {}, "warn");
    await clearSession();
    return { ok: true };
  });
