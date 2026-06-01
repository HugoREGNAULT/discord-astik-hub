CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('paladium-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- Toutes les 10 minutes : snapshot des ventes HDV pour les joueurs suivis + membres de la faction.
SELECT cron.schedule(
  'paladium-sync',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', current_setting('app.bot_api_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
