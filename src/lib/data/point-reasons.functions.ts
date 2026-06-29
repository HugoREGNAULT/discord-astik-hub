import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db.server";
import { requirePermission } from "@/lib/auth/require.server";
import { PILLAR_ZSCHEMA } from "@/lib/data/points-pillars";

export const getPointReasons = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("points.manage");
  const { data, error } = await db
    .from("point_reasons")
    .select("*")
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return { reasons: data ?? [] };
});

export const createPointReason = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        label: z.string().min(1).max(100),
        pillar: PILLAR_ZSCHEMA,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: inserted, error } = await db
      .from("point_reasons")
      .insert({ label: data.label, pillar: data.pillar })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { reason: inserted };
  });

export const togglePointReason = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requirePermission("points.manage");
    const { data: current, error: fetchErr } = await db
      .from("point_reasons")
      .select("active")
      .eq("id", data.id)
      .single();
    if (fetchErr || !current) throw new Error("Motif introuvable");
    const { error: updateErr } = await db
      .from("point_reasons")
      .update({ active: !current.active })
      .eq("id", data.id);
    if (updateErr) throw new Error(updateErr.message);
    return { ok: true, active: !current.active };
  });
