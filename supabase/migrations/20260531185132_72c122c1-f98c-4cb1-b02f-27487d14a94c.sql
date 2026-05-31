CREATE OR REPLACE FUNCTION public.expire_old_carts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.donations
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();
END;
$$;

-- Ensure pg_cron is available (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any previous version of this job, then (re)schedule it
DO $$
BEGIN
  PERFORM cron.unschedule('expire-donations-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-donations-hourly');
END
$$;

SELECT cron.schedule(
  'expire-donations-hourly',
  '0 * * * *',
  $$ SELECT public.expire_old_carts(); $$
);