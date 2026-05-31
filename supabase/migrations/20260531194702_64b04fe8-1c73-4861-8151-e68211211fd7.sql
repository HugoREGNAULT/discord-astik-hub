
ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS target_value numeric,
  ADD COLUMN IF NOT EXISTS current_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewarded boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.objective_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  member_username text,
  amount numeric NOT NULL,
  note text,
  created_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.objective_contributions TO authenticated;
GRANT ALL ON public.objective_contributions TO service_role;

ALTER TABLE public.objective_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objective_contributions readable by authenticated"
  ON public.objective_contributions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_objective_contributions_objective_id
  ON public.objective_contributions(objective_id);
