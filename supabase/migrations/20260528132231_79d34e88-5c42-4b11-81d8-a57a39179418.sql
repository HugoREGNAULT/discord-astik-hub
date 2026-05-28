
CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id text NOT NULL,
  discord_username text NOT NULL,
  mc_name text NOT NULL,
  presentation text NOT NULL,
  age integer NOT NULL,
  country text NOT NULL,
  schedule text NOT NULL,
  weekly_playtime text NOT NULL,
  first_version text NOT NULL,
  ig_grade text NOT NULL,
  previous_factions text,
  heard_from text NOT NULL,
  skills text NOT NULL,
  knowledge_level integer NOT NULL CHECK (knowledge_level BETWEEN 0 AND 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  decided_by_discord_id text,
  decided_by_username text,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_status_created ON public.applications(status, created_at DESC);
CREATE INDEX idx_applications_discord_id ON public.applications(discord_id);

GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Aucune policy : tout passe par les server functions avec la clé service.

CREATE TRIGGER applications_touch_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
