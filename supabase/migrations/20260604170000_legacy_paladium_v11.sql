-- Backlog : indicateur "Actif V11" (saison en cours). Sur Paladium, tout se
-- reset a chaque saison (map, eco, metiers) -> avoir de l'argent / des metiers /
-- une faction = avoir joue la saison actuelle (V11).
ALTER TABLE public.legacy_applications
  ADD COLUMN IF NOT EXISTS paladium_money numeric,         -- solde de la saison
  ADD COLUMN IF NOT EXISTS paladium_jobs jsonb,            -- { miner: 45, farmer: 30, ... }
  ADD COLUMN IF NOT EXISTS paladium_job_total integer,     -- somme des niveaux de metiers
  ADD COLUMN IF NOT EXISTS paladium_played_v11 boolean;    -- argent>0 OU metiers>0 OU faction

CREATE INDEX IF NOT EXISTS idx_legacy_apps_played_v11
  ON public.legacy_applications (paladium_played_v11)
  WHERE paladium_played_v11 IS NOT NULL;
