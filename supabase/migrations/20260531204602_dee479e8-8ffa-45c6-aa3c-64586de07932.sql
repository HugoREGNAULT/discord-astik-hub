-- 1. Colonne ai_review sur applications
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS ai_review jsonb;

-- 2. Crons : process-application-reviews (toutes les 10 min) + purge ai_review (quotidien)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('process-application-reviews');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'process-application-reviews',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/process-application-reviews',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $$
BEGIN
  PERFORM cron.unschedule('purge-application-ai-review');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- Purge RGPD : efface ai_review des candidatures rejetées > 30 jours (et > 7 jours si age < 15).
SELECT cron.schedule(
  'purge-application-ai-review',
  '23 3 * * *',
  $$
  UPDATE public.applications
  SET ai_review = NULL
  WHERE ai_review IS NOT NULL
    AND status = 'rejected'
    AND (
      (age IS NOT NULL AND age < 15 AND decided_at < now() - interval '7 days')
      OR (decided_at < now() - interval '30 days')
    );
  $$
);
