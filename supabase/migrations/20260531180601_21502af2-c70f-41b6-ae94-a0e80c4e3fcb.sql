
CREATE TABLE public.faction_bc_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'libre',
  notes TEXT,
  created_by_discord_id TEXT NOT NULL,
  created_by_username TEXT,
  updated_by_discord_id TEXT,
  updated_by_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.faction_bc_checks TO authenticated;
GRANT ALL ON public.faction_bc_checks TO service_role;

ALTER TABLE public.faction_bc_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bc checks readable by authenticated"
  ON public.faction_bc_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_faction_bc_checks_updated_at
  BEFORE UPDATE ON public.faction_bc_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_faction_bc_checks_status ON public.faction_bc_checks(status);
CREATE INDEX idx_faction_bc_checks_updated ON public.faction_bc_checks(updated_at DESC);
