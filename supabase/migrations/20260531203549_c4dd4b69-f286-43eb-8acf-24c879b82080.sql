CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('scan-anomalies');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'scan-anomalies',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/scan-anomalies',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);