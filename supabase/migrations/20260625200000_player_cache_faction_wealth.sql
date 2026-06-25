-- paladium_player_cache : cache profil Paladium par joueur
CREATE TABLE IF NOT EXISTS public.paladium_player_cache (
  mc_uuid text PRIMARY KEY,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  jobs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paladium_player_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.paladium_player_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- paladium_faction_wealth_history : snapshots richesse faction
CREATE TABLE IF NOT EXISTS public.paladium_faction_wealth_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  faction_name text NOT NULL DEFAULT 'PunkAstik',
  faction_money bigint NOT NULL DEFAULT 0,
  members_money bigint NOT NULL DEFAULT 0,
  listed_value bigint NOT NULL DEFAULT 0,
  total_wealth bigint NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paladium_faction_wealth_history_faction_captured_idx
  ON public.paladium_faction_wealth_history (faction_name, captured_at DESC);

ALTER TABLE public.paladium_faction_wealth_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.paladium_faction_wealth_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);
