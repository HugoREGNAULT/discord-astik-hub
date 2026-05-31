CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('import-mc-stats');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- Toutes les 6h à la minute 23, pour décaler des autres jobs.
SELECT cron.schedule(
  'import-mc-stats',
  '23 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/import-mc-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', current_setting('app.bot_api_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);