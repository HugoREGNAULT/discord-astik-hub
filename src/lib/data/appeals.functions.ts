import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";

export const listAppeals = createServerFn({ method: "GET" })
  .inputValidator((input: { status?: "pending" | "accepted" | "rejected" | "all" } = {}) =>
    z
      .object({ status: z.enum(["pending", "accepted", "rejected", "all"]).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("warnings.write");
    const status = data.status ?? "pending";
    let q = db
      .from("warning_appeals")
      .select(
        "id, warning_id, member_discord_id, message, status, decision_note, decided_by_username, created_at, decided_at",
      )
      .order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const appeals = rows ?? [];
    const warningIds = Array.from(new Set(appeals.map((a) => a.warning_id)));
    const memberIds = Array.from(new Set(appeals.map((a) => a.member_discord_id)));

    const [warningsRes, membersRes] = await Promise.all([
      warningIds.length
        ? db
            .from("warnings")
            .select("id, body, severity, category, status, created_at")
            .in("id", warningIds)
        : Promise.resolve({ data: [] as never[], error: null }),
      memberIds.length
        ? db
            .from("members")
            .select("discord_id, discord_username, ig_name")
            .in("discord_id", memberIds)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);

    const wMap = new Map((warningsRes.data ?? []).map((w: any) => [w.id, w]));
    const mMap = new Map((membersRes.data ?? []).map((m: any) => [m.discord_id, m]));
    return {
      appeals: appeals.map((a) => ({
        ...a,
        warning: wMap.get(a.warning_id) ?? null,
        member: mMap.get(a.member_discord_id) ?? null,
      })),
    };
  });

export const decideAppeal = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        appealId: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("warnings.write");

    const { data: ap, error: aErr } = await db
      .from("warning_appeals")
      .select("id, warning_id, member_discord_id, status")
      .eq("id", data.appealId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!ap) throw new Error("NOT_FOUND");
    if (ap.status !== "pending") throw new Error("Cet appel a déjà été traité");

    const { error: uErr } = await db
      .from("warning_appeals")
      .update({
        status: data.decision,
        decision_note: data.note ?? null,
        decided_by_discord_id: user.discordId,
        decided_by_username: user.username,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.appealId);
    if (uErr) throw new Error(uErr.message);

    if (data.decision === "accepted") {
      await db
        .from("warnings")
        .update({
          status: "revoked",
          revoked_by_discord_id: user.discordId,
          revoked_reason: `Appel accepté${data.note ? ` — ${data.note}` : ""}`,
        })
        .eq("id", ap.warning_id);
    }

    await logAction("warning_appeal_decide", user.discordId, {
      target: ap.member_discord_id,
      appealId: ap.id,
      decision: data.decision,
    });

    const { sendDiscordDM } = await import("@/lib/discord/dm.server");
    const msg =
      data.decision === "accepted"
        ? `✅ Ton appel a été **accepté**. L'avertissement est annulé.${data.note ? `\nNote : ${data.note}` : ""}`
        : `❌ Ton appel a été **rejeté**.${data.note ? `\nMotif : ${data.note}` : ""}`;
    void sendDiscordDM(ap.member_discord_id, msg);

    return { ok: true };
  });
