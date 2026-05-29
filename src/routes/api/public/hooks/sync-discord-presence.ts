/**
 * Cron hook — sync de présence Discord (faction guild).
 *
 * Toutes les minutes : liste tous les membres du serveur faction et met à jour
 * `members.status` ('active' si présent, 'left' sinon). Les users marqués
 * 'left' sont automatiquement bloqués par requireSession.
 *
 * Auth : header `x-bot-key` (BOT_API_KEY) — même clé que les autres endpoints bot.
 */
import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { listAllGuildMembers } from "@/lib/discord/api.server";
import { GUILDS } from "@/lib/discord/constants";
import { db } from "@/lib/db.server";

export const Route = createFileRoute("/api/public/hooks/sync-discord-presence")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        const startedAt = Date.now();
        let guildMembers;
        try {
          guildMembers = await listAllGuildMembers(GUILDS.FACTION);
        } catch (e) {
          return json({ ok: false, error: (e as Error).message }, 502);
        }

        const presentIds = new Set<string>();
        for (const m of guildMembers) {
          if (m.user?.id) presentIds.add(m.user.id);
        }

        const { data: rows, error: readErr } = await db
          .from("members")
          .select("discord_id,status");
        if (readErr) return json({ ok: false, error: readErr.message }, 500);

        const toLeft: string[] = [];
        const toActive: string[] = [];
        for (const r of rows ?? []) {
          const present = presentIds.has(r.discord_id);
          if (!present && r.status !== "left") toLeft.push(r.discord_id);
          else if (present && r.status === "left") toActive.push(r.discord_id);
        }

        if (toLeft.length) {
          const { error } = await db
            .from("members")
            .update({ status: "left", updated_at: new Date().toISOString() })
            .in("discord_id", toLeft);
          if (error) return json({ ok: false, error: error.message }, 500);
        }
        if (toActive.length) {
          const { error } = await db
            .from("members")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .in("discord_id", toActive);
          if (error) return json({ ok: false, error: error.message }, 500);
        }

        // Log d'audit si des changements
        if (toLeft.length || toActive.length) {
          await db.from("logs").insert({
            level: "info",
            action: "discord_presence_sync",
            actor_discord_id: "system",
            payload: { left: toLeft, returned: toActive, total: presentIds.size } as never,
          });
        }

        return json({
          ok: true,
          guild_members: presentIds.size,
          db_members: rows?.length ?? 0,
          marked_left: toLeft.length,
          marked_active: toActive.length,
          duration_ms: Date.now() - startedAt,
        });
      },
    },
  },
});
