CREATE TABLE public.inactivity_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  sent_by_discord_id text,
  sent_by_username text,
  channel text NOT NULL DEFAULT 'dm',
  message text,
  dm_ok boolean,
  dm_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inactivity_pings TO authenticated;
GRANT ALL ON public.inactivity_pings TO service_role;

ALTER TABLE public.inactivity_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inactivity_pings readable by authenticated"
  ON public.inactivity_pings FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_inactivity_pings_member_created
  ON public.inactivity_pings (member_discord_id, created_at DESC);
