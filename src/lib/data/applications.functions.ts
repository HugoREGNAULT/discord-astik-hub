/**
 * Server functions pour les candidatures à la PunkAstik :
 * - submitApplication : un user Discord connecté soumet sa candidature
 * - getMyApplication  : statut de sa propre candidature
 * - listApplications  : recruteurs / staff voient les candidatures
 * - decideApplication : accepter / refuser (perm recruit.access)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requireSession, requirePermission, logAction } from "@/lib/auth/require.server";
import { sendDiscordDM } from "@/lib/discord/dm.server";

const COUNTRIES = ["Belgique", "France", "Canada", "Outre-Mer", "Autre"] as const;
const GRADES = ["Aucun", "Héros", "Légende", "Divinité", "Staff", "Affilié"] as const;

const applicationSchema = z.object({
  mcName: z
    .string()
    .trim()
    .min(3, "Pseudo trop court")
    .max(16, "Max 16 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  presentation: z.string().trim().min(30, "Min 30 caractères").max(3000),
  age: z.number().int().min(10).max(99),
  country: z.enum(COUNTRIES),
  schedule: z.string().trim().min(3).max(300),
  weeklyPlaytime: z.string().trim().min(1).max(100),
  firstVersion: z.string().trim().min(1).max(50),
  igGrade: z.enum(GRADES),
  previousFactions: z.string().trim().max(1000).optional().default(""),
  heardFrom: z.string().trim().min(2).max(300),
  skills: z.string().trim().min(2).max(1000),
  knowledgeLevel: z.number().int().min(0).max(10),
});

async function fetchMojang(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
  );
  if (res.status === 404) throw new Error("Ce pseudo Minecraft n'existe pas.");
  if (!res.ok) throw new Error("Impossible de vérifier le pseudo (API Mojang).");
  const body = (await res.json()) as { id?: string; name?: string };
  if (!body.id || !body.name) throw new Error("Réponse Mojang invalide.");
  return { id: body.id, name: body.name };
}

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSession();

    // Vérifie qu'il n'a pas déjà une candidature en attente
    const existing = await db
      .from("applications")
      .select("id, status")
      .eq("discord_id", user.discordId)
      .in("status", ["pending"])
      .maybeSingle();
    if (existing.data) {
      throw new Error("Tu as déjà une candidature en attente.");
    }

    // Si déjà membre, pas besoin de candidater
    const isMember = await db
      .from("members")
      .select("discord_id, ig_name")
      .eq("discord_id", user.discordId)
      .maybeSingle();
    if (isMember.data?.ig_name) {
      throw new Error("Tu es déjà membre de la PunkAstik.");
    }

    // Validation du pseudo Minecraft
    const mojang = await fetchMojang(data.mcName);

    const ins = await db
      .from("applications")
      .insert({
        discord_id: user.discordId,
        discord_username: user.username,
        mc_name: mojang.name,
        presentation: data.presentation,
        age: data.age,
        country: data.country,
        schedule: data.schedule,
        weekly_playtime: data.weeklyPlaytime,
        first_version: data.firstVersion,
        ig_grade: data.igGrade,
        previous_factions: data.previousFactions || null,
        heard_from: data.heardFrom,
        skills: data.skills,
        knowledge_level: data.knowledgeLevel,
        status: "pending",
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);

    await logAction("application_submit", user.discordId, {
      application_id: ins.data.id,
      mc_name: mojang.name,
    });

    return { ok: true, applicationId: ins.data.id };
  });

export const getMyApplication = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const res = await db
    .from("applications")
    .select("id, status, created_at, decided_at, decision_reason, mc_name")
    .eq("discord_id", user.discordId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data ?? null;
});

export const listApplications = createServerFn({ method: "GET" })
  .inputValidator((input: { status?: "pending" | "accepted" | "rejected" }) => input ?? {})
  .handler(async ({ data }) => {
    await requirePermission("recruit.access");
    const q = db.from("applications").select("*").order("created_at", { ascending: false });
    if (data.status) q.eq("status", data.status);
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return res.data ?? [];
  });

const decideSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(1000).optional().default(""),
});

export const decideApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => decideSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await requirePermission("recruit.access");

    const appRes = await db
      .from("applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appRes.error) throw new Error(appRes.error.message);
    if (!appRes.data) throw new Error("Candidature introuvable.");
    if (appRes.data.status !== "pending") {
      throw new Error("Cette candidature a déjà été traitée.");
    }
    const app = appRes.data;

    const upd = await db
      .from("applications")
      .update({
        status: data.decision,
        decided_by_discord_id: staff.discordId,
        decided_by_username: staff.username,
        decided_at: new Date().toISOString(),
        decision_reason: data.reason || null,
      })
      .eq("id", data.applicationId);
    if (upd.error) throw new Error(upd.error.message);

    // Sur acceptation : créer / mettre à jour la fiche membre
    if (data.decision === "accepted") {
      // Récup UUID Minecraft
      let mcUuid: string | null = null;
      try {
        const m = await fetchMojang(app.mc_name);
        mcUuid = m.id;
      } catch {
        mcUuid = null;
      }

      await db.from("members").upsert(
        {
          discord_id: app.discord_id,
          discord_username: app.discord_username,
          ig_name: app.mc_name,
          mc_uuid: mcUuid,
          arrival_date: new Date().toISOString().slice(0, 10),
          recruiter_discord_id: staff.discordId,
          status: "active",
        },
        { onConflict: "discord_id" },
      );
    }

    // Notification DM Discord
    const message =
      data.decision === "accepted"
        ? `🎉 **Bienvenue dans la PunkAstik !**\n\nTa candidature a été acceptée par **${staff.username}**.\nTu peux désormais accéder à ton espace membre : https://discord-astik-hub.lovable.app/me${
            data.reason ? `\n\n💬 ${data.reason}` : ""
          }`
        : `❌ **Candidature refusée**\n\nDésolé, ta candidature à la PunkAstik n'a pas été retenue par **${staff.username}**.${
            data.reason ? `\n\n💬 Motif : ${data.reason}` : ""
          }`;
    const dm = await sendDiscordDM(app.discord_id, message);

    await logAction(
      data.decision === "accepted" ? "application_accept" : "application_reject",
      staff.discordId,
      {
        application_id: app.id,
        candidate: app.discord_id,
        dm_ok: dm.ok,
        dm_error: dm.error ?? null,
      },
    );

    return { ok: true, dmOk: dm.ok, dmError: dm.error ?? null };
  });
