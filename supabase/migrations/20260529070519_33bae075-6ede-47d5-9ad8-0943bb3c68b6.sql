CREATE TABLE public.absences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_discord_id text NOT NULL,
  created_by_discord_id text NOT NULL,
  created_by_username text,
  type text NOT NULL DEFAULT 'other',
  reason text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT absences_type_check CHECK (type IN ('vacation','irl','illness','other')),
  CONSTRAINT absences_dates_check CHECK (ends_on >= starts_on)
);

CREATE INDEX idx_absences_range ON public.absences (starts_on, ends_on);
CREATE INDEX idx_absences_member ON public.absences (member_discord_id);

GRANT ALL ON public.absences TO service_role;

CREATE TRIGGER absences_set_updated_at
BEFORE UPDATE ON public.absences
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;