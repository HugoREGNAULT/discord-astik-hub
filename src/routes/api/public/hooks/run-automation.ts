/**
 * Hook public (pg_cron) — moteur d'automation.
 *
 * Lit `automation_rules` enabled=true, évalue chaque trigger, et :
 * - mode 'propose' : crée une notification "automation_proposal" pour les
 *   admins (haut staff). N'exécute RIEN.
 * - mode 'execute' : exécute uniquement des actions non sensibles
 *   (kind 'notify' ou 'dm'). Pas de warn, pas de retrait de points,
 *   pas de ban — JAMAIS.
 *
 * Auth : header x-bot-key (BOT_API_KEY).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireBotAuth } from "@/lib/bot-auth.server";
import { db } from "@/lib/db.server";
import { notify } from "@/lib/data/notify.server";
import { ROLES } from "@/lib/discord/constants";

const triggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inactive_days"),
    days: z.number().int().min(1).max(365),
  }),
  z.object({
    type: z.literal("low_messages_7d"),
    threshold: z.number().int().min(0).max(10_000),
  }),
]);

const actionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("notify"),
    title: z.string().min(1).max(200),
    detail: z.string().max(2000).optional(),
    href: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal("dm"),
    title: z.string().min(1).max(200),
    detail: z.string().max(2000).optional(),
  }),
  // Actions sensibles : déclarables en mode propose UNIQUEMENT.
  z.object({
    kind: z.literal("warn"),
    severity: z.enum(["verbal", "minor", "major", "severe"]).default("minor"),
    body: z.string().min(1).max(2000),
  }),
  z.object({
    kind: z.literal("remove_points"),
    amount: z.number().int().min(1).max(10_000),
    reason: z.string().min(1).max(500),
  }),
]);

type Trigger = z.infer<typeof triggerSchema>;
type Action = z.infer<typeof actionSchema>;

const SAFE_KINDS: ReadonlyArray<Action["kind"]> = ["notify", "dm"];

const STAFF_ROLE_IDS = [ROLES.STAFF_FACTION, ROLES.HIGH_STAFF_PUBLIC] as const;

async function listStaffDiscordIds(): Promise<string[]> {
  const { data } = await db
    .from("discord_role_cache")
    .select("discord_id, role_ids");
  if (!data) return [];
  const set = new Set<string>();
  for (const row of data) {
    const roles = (row.role_ids ?? []) as string[];
    if (roles.some((r) => STAFF_ROLE_IDS.includes(r as (typeof STAFF_ROLE_IDS)[number]))) {
      set.add(row.discord_id);
    }
  }
  return [...set];
}

async function evalTrigger(trigger: Trigger): Promise<
  Array<{ discordId: string; ig: string | null }>
> {
  if (trigger.type === "inactive_days") {
    const cutoff = new Date(Date.now() - trigger.days * 86_400_000).toISOString();
    const { data } = await db
      .from("members")
      .select("discord_id, ig_name, updated_at, messages_7d, voice_7d_seconds")
      .eq("status", "active")
      .lte("updated_at", cutoff)
      .eq("messages_7d", 0)
      .eq("voice_7d_seconds", 0)
      .limit(200);
    return (data ?? []).map((m) => ({ discordId: m.discord_id, ig: m.ig_name }));
  }
  if (trigger.type === "low_messages_7d") {
    const { data } = await db
      .from("members")
      .select("discord_id, ig_name, messages_7d")
      .eq("status", "active")
      .lte("messages_7d", trigger.threshold)
      .limit(200);
    return (data ?? []).map((m) => ({ discordId: m.discord_id, ig: m.ig_name }));
  }
  return [];
}

async function runRule(rule: {
  id: string;
  name: string;
  trigger: unknown;
  action: unknown;
  mode: string;
}): Promise<{ name: string; matched: number; notified: number; mode: string }> {
  let trigger: Trigger;
  let action: Action;
  try {
    trigger = triggerSchema.parse(rule.trigger);
    action = actionSchema.parse(rule.action);
  } catch (err) {
    console.error("run-automation: invalid rule schema", rule.id, err);
    return { name: rule.name, matched: 0, notified: 0, mode: rule.mode };
  }

  const matches = await evalTrigger(trigger);
  let notified = 0;

  if (rule.mode === "propose") {
    // Une notif unique au staff résumant la règle + nb de matchs.
    const staff = await listStaffDiscordIds();
    const detail = `${matches.length} membre(s) ciblé(s) — Action proposée : ${action.kind}${
      "title" in action ? ` "${action.title}"` : ""
    }${
      action.kind === "warn"
        ? ` (gravité ${action.severity})`
        : action.kind === "remove_points"
          ? ` (-${action.amount} pts)`
          : ""
    }`;
    for (const sid of staff) {
      await notify({
        recipientDiscordId: sid,
        kind: "automation_proposal",
        title: `🤖 Proposition : ${rule.name}`,
        detail,
        href: "/staff",
      });
      notified += 1;
    }
  } else if (rule.mode === "execute") {
    if (!SAFE_KINDS.includes(action.kind)) {
      console.warn(
        "run-automation: rule",
        rule.id,
        "demande action sensible en mode execute — IGNORÉ",
      );
    } else if (action.kind === "notify" || action.kind === "dm") {
      for (const m of matches) {
        await notify({
          recipientDiscordId: m.discordId,
          kind: "automation",
          title: action.title,
          detail: "detail" in action ? action.detail : undefined,
          href: action.kind === "notify" && "href" in action ? action.href : undefined,
        });
        notified += 1;
      }
    }
  }

  await db
    .from("automation_rules")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", rule.id);

  return { name: rule.name, matched: matches.length, notified, mode: rule.mode };
}

export const Route = createFileRoute("/api/public/hooks/run-automation")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const unauth = requireBotAuth(request);
        if (unauth) return unauth;

        try {
          const { data: rules } = await db
            .from("automation_rules")
            .select("id, name, trigger, action, mode")
            .eq("enabled", true);

          const summary: Array<Awaited<ReturnType<typeof runRule>>> = [];
          for (const r of rules ?? []) {
            summary.push(await runRule(r));
          }
          return Response.json({ ok: true, processed: summary.length, summary });
        } catch (err) {
          console.error("run-automation failed", err);
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
