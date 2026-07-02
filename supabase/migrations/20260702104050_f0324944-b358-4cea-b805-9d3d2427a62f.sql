-- 1. pillar column on points_ledger
ALTER TABLE public.points_ledger
  ADD COLUMN IF NOT EXISTS pillar text
  CHECK (pillar IN ('discord_activity','ig_investment','global_investment'));

-- 2. point_reasons table
CREATE TABLE IF NOT EXISTS public.point_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  pillar text NOT NULL CHECK (pillar IN ('discord_activity','ig_investment','global_investment')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.point_reasons FROM anon, authenticated;
GRANT ALL ON public.point_reasons TO service_role;
ALTER TABLE public.point_reasons ENABLE ROW LEVEL SECURITY;

-- 3. paladium_faction_wealth_history table
CREATE TABLE IF NOT EXISTS public.paladium_faction_wealth_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_name text NOT NULL,
  faction_money bigint NOT NULL DEFAULT 0,
  members_money bigint NOT NULL DEFAULT 0,
  listed_value bigint NOT NULL DEFAULT 0,
  total_wealth bigint NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wealth_history_faction_time
  ON public.paladium_faction_wealth_history (faction_name, captured_at DESC);
REVOKE ALL ON public.paladium_faction_wealth_history FROM anon, authenticated;
GRANT ALL ON public.paladium_faction_wealth_history TO service_role;
ALTER TABLE public.paladium_faction_wealth_history ENABLE ROW LEVEL SECURITY;