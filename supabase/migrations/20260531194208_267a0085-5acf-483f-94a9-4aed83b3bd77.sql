
-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  created_by_discord_id text NOT NULL,
  created_by_username text,
  report text,
  loot_distributed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events readable by authenticated" ON public.events FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_events_starts_at ON public.events (starts_at DESC);

CREATE TRIGGER events_touch_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- event_signups
CREATE TABLE public.event_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  member_username text,
  rsvp text NOT NULL,
  attended boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_discord_id)
);
GRANT SELECT ON public.event_signups TO authenticated;
GRANT ALL ON public.event_signups TO service_role;
ALTER TABLE public.event_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_signups readable by authenticated" ON public.event_signups FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_event_signups_event_id ON public.event_signups (event_id);

CREATE TRIGGER event_signups_touch_updated_at
BEFORE UPDATE ON public.event_signups
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- event_loot
CREATE TABLE public.event_loot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  points integer NOT NULL,
  note text,
  ledger_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_discord_id)
);
GRANT SELECT ON public.event_loot TO authenticated;
GRANT ALL ON public.event_loot TO service_role;
ALTER TABLE public.event_loot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_loot readable by authenticated" ON public.event_loot FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_event_loot_event_id ON public.event_loot (event_id);
