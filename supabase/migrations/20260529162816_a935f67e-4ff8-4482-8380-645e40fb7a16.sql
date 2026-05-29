CREATE TABLE public.ai_digests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL UNIQUE,
  content text NOT NULL,
  summary text,
  model text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by text NOT NULL DEFAULT 'cron',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_digests TO authenticated;
GRANT ALL ON public.ai_digests TO service_role;

ALTER TABLE public.ai_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_digests readable by authenticated"
  ON public.ai_digests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX ai_digests_week_start_idx ON public.ai_digests (week_start DESC);