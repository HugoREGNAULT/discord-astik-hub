/**
 * Inactivité : file de relance + DM tracé.
 *
 * - Score = nb de jours d'inactivité continue (messages_7d == 0 ET voice_7d_seconds == 0).
 * - Croise avec absences déclarées (starts_on <= today <= ends_on).
 * - Joint la dernière relance (lastPingAt) par membre.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission, logAction } from "@/lib/auth/require.server";
import { filterFactionMembers } from "@/lib/data/faction-members";

const DAY_MS = 86_400_000;

export type InactivityQueueRow = {
  discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  current_grade: string | null;
  arrival_date: string | null;
  mc_uuid: string | null;
  inactivityDays: number;
  onDeclaredAbsence: boolean;
  absenceUntil: string | null;
  lastPingAt: string | null;
};

export const getInactivityQueue = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const since30dIso = new Date(now - 31 * DAY_MS).toISOString();

  const [membersRes, snapshotsRes, absencesRes, pingsRes] = await Promise.all([
    db
      .from("members")
      .select(
        "discord_id, discord_username, ig_name, avatar_url, current_grade, arrival_date, mc_uuid, messages_7d, voice_7d_seconds, messages_total, voice_total_seconds, updated_at",
      )
      .eq("status", "active")
      .eq("messages_7d", 0)
      .eq("voice_7d_seconds", 0),
    db
      .from("leaderboard_snapshots")
      .select("discord_id, taken_at, messages_total, voice_total_seconds")
      .gte("taken_at", since30dIso)
      .order("taken_at", { ascending: false })
      .limit(200_000),
    db
      .from("absences")
      .select("member_discord_id, starts_on, ends_on")
      .lte("starts_on", today)
      .gte("ends_on", today),
    db
      .from("inactivity_pings")
      .select("member_discord_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10_000),
  ]);

  const inactive = filterFactionMembers(membersRes.data ?? []);

  // Group snapshots by member, already sorted desc by taken_at.
  type Snap = { taken_at: string; messages_total: number; voice_total_seconds: number };
  const byMember = new Map<string, Snap[]>();
  for (const row of (snapshotsRes.data ?? []) as Array<{ discord_id: string } & Snap>) {
    const arr = byMember.get(row.discord_id);
    if (arr) arr.push(row);
    else byMember.set(row.discord_id, [row]);
  }

  // Absences active today
  const absUntil = new Map<string, string>();
  for (const a of (absencesRes.data ?? []) as Array<{
    member_discord_id: string;
    ends_on: string;
  }>) {
    const prev = absUntil.get(a.member_discord_id);
    if (!prev || a.ends_on > prev) absUntil.set(a.member_discord_id, a.ends_on);
  }

  // Last ping per member
  const lastPing = new Map<string, string>();
  for (const p of (pingsRes.data ?? []) as Array<{
    member_discord_id: string;
    created_at: string;
  }>) {
    if (!lastPing.has(p.member_discord_id)) {
      lastPing.set(p.member_discord_id, p.created_at);
    }
  }

  const rows: InactivityQueueRow[] = inactive.map((m) => {
    const snaps = byMember.get(m.discord_id) ?? [];
    // Walk newest -> oldest, accumulate days while delta vs current totals == 0
    let inactivityDays = 7; // baseline (messages_7d == 0 == voice_7d_seconds)
    const currentMsg = m.messages_total ?? 0;
    const currentVoice = m.voice_total_seconds ?? 0;
    let oldestZeroAt: number | null = null;
    for (const s of snaps) {
      const dMsg = currentMsg - (s.messages_total ?? 0);
      const dVoice = currentVoice - (s.voice_total_seconds ?? 0);
      if (dMsg <= 0 && dVoice <= 0) {
        oldestZeroAt = new Date(s.taken_at).getTime();
      } else {
        break;
      }
    }
    if (oldestZeroAt !== null) {
      const days = Math.floor((now - oldestZeroAt) / DAY_MS);
      if (days > inactivityDays) inactivityDays = days;
    }

    const until = absUntil.get(m.discord_id) ?? null;
    return {
      discord_id: m.discord_id,
      discord_username: m.discord_username ?? null,
      ig_name: m.ig_name ?? null,
      avatar_url: m.avatar_url ?? null,
      current_grade: m.current_grade ?? null,
      arrival_date: m.arrival_date ?? null,
      mc_uuid: m.mc_uuid ?? null,
      inactivityDays,
      onDeclaredAbsence: !!until,
      absenceUntil: until,
      lastPingAt: lastPing.get(m.discord_id) ?? null,
    };
  });

  rows.sort((a, b) => b.inactivityDays - a.inactivityDays);
  return { rows, total: rows.length };
});

export const sendInactivityPing = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        memberDiscordId: z.string().min(1).max(32),
        message: z.string().min(1).max(1800),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requirePermission("members.edit");
    const { sendDiscordDM } = await import("@/lib/discord/dm.server");
    const res = await sendDiscordDM(data.memberDiscordId, data.message);

    await db.from("inactivity_pings").insert({
      member_discord_id: data.memberDiscordId,
      sent_by_discord_id: user.discordId,
      sent_by_username: user.username ?? null,
      channel: "dm",
      message: data.message,
      dm_ok: res.ok,
      dm_error: res.error ?? null,
    });

    await logAction("inactivity_ping", user.discordId, {
      target: data.memberDiscordId,
      ok: res.ok,
      error: res.error,
      length: data.message.length,
    });

    if (!res.ok) throw new Error(res.error ?? "Échec de l'envoi du DM");
    return { ok: true };
  });

export const getMemberInactivityHistory = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ memberDiscordId: z.string().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("members.view");
    const { data: rows, error } = await db
      .from("inactivity_pings")
      .select("*")
      .eq("member_discord_id", data.memberDiscordId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { pings: rows ?? [] };
  });
