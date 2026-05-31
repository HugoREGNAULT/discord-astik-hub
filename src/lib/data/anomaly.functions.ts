/**
 * Détection statistique d'anomalies (7 derniers jours) - PAS d'IA.
 *
 * Quatre types :
 *  - point_farm     : z-score robuste (MAD) > 3.5 sur les points positifs 7j.
 *  - alt_transfer   : échanges de points en boucle entre un membre et un alt connu.
 *  - ratio_mismatch : messages_7d >= p90 ET voice_7d_seconds ~ 0 (ou inverse).
 *  - new_farmer     : arrivée < 7j ET points positifs 7j dans le top 10%.
 *
 * NE prend aucune décision. NE touche ni aux points ni aux warnings.
 * Upsert sur l'index unique partiel (member_discord_id, kind) WHERE status='open'.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
// requireBotAuth est utilisé par le hook public qui appellera _runAnomalyScan.
import { logAction, requirePermission } from "@/lib/auth/require.server";

const DAY_MS = 86_400_000;

type AnomalyKind = "point_farm" | "alt_transfer" | "ratio_mismatch" | "new_farmer";
type Severity = "low" | "med" | "high";

type FlagInput = {
  member_discord_id: string;
  kind: AnomalyKind;
  severity: Severity;
  score: number | null;
  evidence: Record<string, unknown>;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mad(values: number[], med: number): number {
  if (values.length === 0) return 0;
  const dev = values.map((v) => Math.abs(v - med));
  return median(dev);
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

const ScanInput = z.object({}).optional();

async function runScan(): Promise<{
  scanned: number;
  flagged: number;
  byKind: Record<AnomalyKind, number>;
}> {
  const now = Date.now();
  const since7dIso = new Date(now - 7 * DAY_MS).toISOString();
  const sevenDaysAgoDate = new Date(now - 7 * DAY_MS).toISOString().slice(0, 10);

  const [membersRes, ledgerRes, altsRes] = await Promise.all([
    db
      .from("members")
      .select("discord_id, arrival_date, messages_7d, voice_7d_seconds")
      .eq("status", "active"),
    db
      .from("points_ledger")
      .select("member_discord_id, staff_discord_id, amount, action_type, created_at")
      .gte("created_at", since7dIso)
      .limit(100_000),
    db.from("member_alts").select("member_discord_id, alt_discord_id"),
  ]);

  const members = (membersRes.data ?? []) as Array<{
    discord_id: string;
    arrival_date: string | null;
    messages_7d: number;
    voice_7d_seconds: number;
  }>;
  const ledger = (ledgerRes.data ?? []) as Array<{
    member_discord_id: string;
    staff_discord_id: string | null;
    amount: number;
    action_type: string;
    created_at: string;
  }>;
  const alts = (altsRes.data ?? []) as Array<{
    member_discord_id: string;
    alt_discord_id: string | null;
  }>;

  const activeIds = new Set(members.map((m) => m.discord_id));

  // --- Somme des points POSITIFS sur 7j par membre ---
  const positiveByMember = new Map<string, number>();
  for (const id of activeIds) positiveByMember.set(id, 0);
  for (const row of ledger) {
    if (!activeIds.has(row.member_discord_id)) continue;
    if (row.amount > 0) {
      positiveByMember.set(
        row.member_discord_id,
        (positiveByMember.get(row.member_discord_id) ?? 0) + row.amount,
      );
    }
  }

  const positives = [...positiveByMember.values()];
  const med = median(positives);
  const m = mad(positives, med);
  const madScale = m === 0 ? 1 : 1.4826 * m; // scale MAD → sigma
  const p90 = quantile(positives.filter((v) => v > 0), 0.9);

  const flags: FlagInput[] = [];

  // --- 1. point_farm : z-score robuste > 3.5 ou > med + 4*MAD ---
  for (const [id, total] of positiveByMember) {
    if (total <= 0) continue;
    const z = (total - med) / madScale;
    const overMad = total > med + 4 * m;
    if (z > 3.5 || overMad) {
      const severity: Severity = z > 6 ? "high" : z > 4.5 ? "med" : "low";
      flags.push({
        member_discord_id: id,
        kind: "point_farm",
        severity,
        score: Math.round(z * 100) / 100,
        evidence: {
          positive_points_7d: total,
          median: med,
          mad: m,
          mad_scaled: madScale,
          z_score_robust: z,
          threshold_z: 3.5,
        },
      });
    }
  }

  // --- 2. alt_transfer : boucles entre un membre et un alt connu ---
  const altMap = new Map<string, Set<string>>(); // member -> set(alt_ids)
  for (const a of alts) {
    if (!a.alt_discord_id) continue;
    const s = altMap.get(a.member_discord_id) ?? new Set<string>();
    s.add(a.alt_discord_id);
    altMap.set(a.member_discord_id, s);
    // bidirectionnel
    const s2 = altMap.get(a.alt_discord_id) ?? new Set<string>();
    s2.add(a.member_discord_id);
    altMap.set(a.alt_discord_id, s2);
  }

  // somme des transferts member <-> alts
  const transferAgg = new Map<
    string,
    { toAlt: number; fromAlt: number; altIds: Set<string>; count: number }
  >();
  for (const row of ledger) {
    const staff = row.staff_discord_id;
    if (!staff) continue;
    const member = row.member_discord_id;
    if (member === staff) continue;
    const memberAlts = altMap.get(member);
    if (!memberAlts || !memberAlts.has(staff)) continue;
    const agg = transferAgg.get(member) ?? {
      toAlt: 0,
      fromAlt: 0,
      altIds: new Set<string>(),
      count: 0,
    };
    agg.altIds.add(staff);
    agg.count += 1;
    if (row.amount > 0) agg.fromAlt += row.amount;
    else agg.toAlt += Math.abs(row.amount);
    transferAgg.set(member, agg);
  }
  for (const [id, agg] of transferAgg) {
    // boucle = mouvement dans les deux sens OU plus de 3 transferts unidirectionnels
    const isLoop = agg.toAlt > 0 && agg.fromAlt > 0;
    if (!isLoop && agg.count < 3) continue;
    const volume = agg.toAlt + agg.fromAlt;
    const severity: Severity = isLoop && volume > 500 ? "high" : isLoop ? "med" : "low";
    flags.push({
      member_discord_id: id,
      kind: "alt_transfer",
      severity,
      score: volume,
      evidence: {
        alt_ids: [...agg.altIds],
        transfer_count: agg.count,
        points_to_alt: agg.toAlt,
        points_from_alt: agg.fromAlt,
        is_loop: isLoop,
      },
    });
  }

  // --- 3. ratio_mismatch : messages_7d vs voice_7d_seconds ---
  const msgs = members.map((m) => m.messages_7d ?? 0).filter((v) => v > 0);
  const voices = members.map((m) => m.voice_7d_seconds ?? 0).filter((v) => v > 0);
  const msgP90 = quantile(msgs, 0.9);
  const voiceP90 = quantile(voices, 0.9);
  for (const mb of members) {
    const msg = mb.messages_7d ?? 0;
    const voice = mb.voice_7d_seconds ?? 0;
    const msgHighNoVoice = msg >= msgP90 && msgP90 > 0 && voice < 60;
    const voiceHighNoMsg = voice >= voiceP90 && voiceP90 > 0 && msg < 5;
    if (!msgHighNoVoice && !voiceHighNoMsg) continue;
    const severity: Severity = msg > msgP90 * 2 || voice > voiceP90 * 2 ? "med" : "low";
    flags.push({
      member_discord_id: mb.discord_id,
      kind: "ratio_mismatch",
      severity,
      score: msgHighNoVoice ? msg : voice,
      evidence: {
        messages_7d: msg,
        voice_7d_seconds: voice,
        messages_p90: msgP90,
        voice_p90: voiceP90,
        pattern: msgHighNoVoice ? "msg_no_voice" : "voice_no_msg",
      },
    });
  }

  // --- 4. new_farmer : arrivée < 7j ET top 10% des points positifs ---
  const positivesNonZero = positives.filter((v) => v > 0);
  const top10 = quantile(positivesNonZero, 0.9);
  for (const mb of members) {
    if (!mb.arrival_date) continue;
    if (mb.arrival_date < sevenDaysAgoDate) continue;
    const total = positiveByMember.get(mb.discord_id) ?? 0;
    if (total <= 0 || total < top10 || top10 === 0) continue;
    flags.push({
      member_discord_id: mb.discord_id,
      kind: "new_farmer",
      severity: total > top10 * 2 ? "high" : "med",
      score: total,
      evidence: {
        arrival_date: mb.arrival_date,
        days_in_faction: Math.floor((now - new Date(mb.arrival_date).getTime()) / DAY_MS),
        positive_points_7d: total,
        top10_threshold: top10,
      },
    });
  }

  // --- Upsert sans doublon (onConflict sur index unique partiel) ---
  const byKind: Record<AnomalyKind, number> = {
    point_farm: 0,
    alt_transfer: 0,
    ratio_mismatch: 0,
    new_farmer: 0,
  };

  if (flags.length > 0) {
    // upsert ligne par ligne pour respecter l'index unique partiel WHERE status='open'
    for (const f of flags) {
      byKind[f.kind] += 1;
      // Vérifie s'il existe déjà un flag open
      const existing = await db
        .from("anomaly_flags")
        .select("id")
        .eq("member_discord_id", f.member_discord_id)
        .eq("kind", f.kind)
        .eq("status", "open")
        .maybeSingle();
      const evidenceJson = f.evidence as never;
      if (existing.data?.id) {
        await db
          .from("anomaly_flags")
          .update({
            severity: f.severity,
            score: f.score,
            evidence: evidenceJson,
          })
          .eq("id", existing.data.id);
      } else {
        await db.from("anomaly_flags").insert({
          member_discord_id: f.member_discord_id,
          kind: f.kind,
          severity: f.severity,
          score: f.score,
          evidence: evidenceJson,
        });
      }
    }
  }

  await logAction("anomaly.scan", "system", {
    scanned: members.length,
    flagged: flags.length,
    byKind,
  });

  return { scanned: members.length, flagged: flags.length, byKind };
}

/**
 * Server function : scanAnomalies.
 * - Si appelée avec un header `x-bot-key` valide (via hook public), authentifie via requireBotAuth.
 * - Sinon, gatée par requirePermission("members.edit") n'est PAS faite ici (réservé au bot/cron).
 *   L'appel direct depuis l'UI doit passer par un endpoint dédié.
 */
export const scanAnomalies = createServerFn({ method: "POST" })
  .inputValidator((input) => ScanInput.parse(input))
  .handler(async () => {
    return runScan();
  });

export { runScan as _runAnomalyScan };

// ──────────────────────────────────────────────────────────────────────────────
// UI server functions : liste + revue manuelle.
// ──────────────────────────────────────────────────────────────────────────────

export type AnomalyEvidence =
  | string
  | number
  | boolean
  | null
  | AnomalyEvidence[]
  | { [k: string]: AnomalyEvidence };

export type OpenAnomalyRow = {
  id: string;
  member_discord_id: string;
  discord_username: string | null;
  ig_name: string | null;
  avatar_url: string | null;
  kind: AnomalyKind;
  severity: Severity;
  score: number | null;
  evidence: AnomalyEvidence;
  ai_explanation: string | null;
  created_at: string;
};

const SEVERITY_RANK: Record<Severity, number> = { high: 3, med: 2, low: 1 };

export const getOpenAnomalies = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("members.view");

  const { data: flags } = await db
    .from("anomaly_flags")
    .select(
      "id, member_discord_id, kind, severity, score, evidence, ai_explanation, created_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (flags ?? []) as Array<{
    id: string;
    member_discord_id: string;
    kind: AnomalyKind;
    severity: Severity;
    score: number | null;
    evidence: Record<string, unknown>;
    ai_explanation: string | null;
    created_at: string;
  }>;

  const memberIds = [...new Set(rows.map((r) => r.member_discord_id))];
  const membersById = new Map<
    string,
    { discord_username: string | null; ig_name: string | null; avatar_url: string | null }
  >();
  if (memberIds.length > 0) {
    const { data: members } = await db
      .from("members")
      .select("discord_id, discord_username, ig_name, avatar_url")
      .in("discord_id", memberIds);
    for (const m of (members ?? []) as Array<{
      discord_id: string;
      discord_username: string | null;
      ig_name: string | null;
      avatar_url: string | null;
    }>) {
      membersById.set(m.discord_id, {
        discord_username: m.discord_username,
        ig_name: m.ig_name,
        avatar_url: m.avatar_url,
      });
    }
  }

  const enriched: OpenAnomalyRow[] = rows.map((r) => {
    const mb = membersById.get(r.member_discord_id);
    return {
      id: r.id,
      member_discord_id: r.member_discord_id,
      discord_username: mb?.discord_username ?? null,
      ig_name: mb?.ig_name ?? null,
      avatar_url: mb?.avatar_url ?? null,
      kind: r.kind,
      severity: r.severity,
      score: r.score,
      evidence: r.evidence,
      ai_explanation: r.ai_explanation,
      created_at: r.created_at,
    };
  });

  // Sort severity desc, then created_at desc
  enriched.sort((a, b) => {
    const rs = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rs !== 0) return rs;
    return b.created_at.localeCompare(a.created_at);
  });

  return { rows: enriched };
});

const UpdateStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "dismissed"]),
});

export const updateAnomalyStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => UpdateStatusInput.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission("members.view");

    const { error } = await db
      .from("anomaly_flags")
      .update({
        status: data.status,
        reviewed_by_discord_id: user.discordId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "open");

    if (error) throw new Error(error.message);

    await logAction("anomaly.review", user.discordId, {
      flag_id: data.id,
      status: data.status,
    });

    return { ok: true };
  });

