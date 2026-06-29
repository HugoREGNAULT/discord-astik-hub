import { z } from "zod";

export const PILLAR_OPTIONS = [
  { value: "discord_activity" as const, label: "Activité Discord" },
  { value: "ig_investment" as const, label: "Investissement IG" },
  { value: "global_investment" as const, label: "Investissement Global" },
] as const;

export type PointPillar = (typeof PILLAR_OPTIONS)[number]["value"];

export const PILLAR_ZSCHEMA = z.enum(["discord_activity", "ig_investment", "global_investment"]);
