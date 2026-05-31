
ALTER TABLE public.warnings
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'minor',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revoked_by_discord_id text,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

CREATE TABLE IF NOT EXISTS public.warning_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id uuid NOT NULL REFERENCES public.warnings(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by_discord_id text,
  decided_by_username text,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

GRANT SELECT ON public.warning_appeals TO authenticated;
GRANT ALL ON public.warning_appeals TO service_role;

ALTER TABLE public.warning_appeals ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS warning_appeals_one_pending
  ON public.warning_appeals(warning_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_warning_appeals_member ON public.warning_appeals(member_discord_id);
CREATE INDEX IF NOT EXISTS idx_warning_appeals_status ON public.warning_appeals(status);

DO $$
BEGIN
  PERFORM cron.unschedule('expire-warnings-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'expire-warnings-daily',
  '7 4 * * *',
  $$
  UPDATE public.warnings
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at IS NOT NULL
     AND expires_at < now();
  $$
);
