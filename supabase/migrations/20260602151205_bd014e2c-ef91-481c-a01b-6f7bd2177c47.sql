CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-discord-presence');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- Every minute: synchronise members.status with the Discord faction guild presence
SELECT cron.schedule(
  'sync-discord-presence',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/sync-discord-presence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', current_setting('app.bot_api_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Trigger an immediate sync so stale 'active' rows get reconciled now
SELECT net.http_post(
  url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/sync-discord-presence',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-bot-key', current_setting('app.bot_api_key', true)
  ),
  body := '{}'::jsonb
);