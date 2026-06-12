-- Répare les crons HTTP morts depuis le durcissement requireBotAuth (31 mai).
--
-- Constat (audit prod 2026-06-13) :
--   - Le GUC `app.bot_api_key` n'a JAMAIS été configuré (et le rôle du SQL
--     editor n'a pas le droit de faire ALTER DATABASE ... SET → impossible à
--     poser) → les 3 jobs qui l'utilisaient envoyaient un header null → 401.
--   - 8 autres jobs n'envoyaient AUCUNE clé → 401 silencieux aussi.
--   - pg_net affiche "succeeded" même sur un 401 (il ne lit pas la réponse),
--     d'où des semaines de pannes invisibles (paladium_player_listings_history
--     vide, digests/anomalies/automations/reviews IA jamais déclenchés par cron).
--   - Doublon : `paladium-sync-listings` tapait la même URL que `paladium-sync`.
--
-- Correctif : la clé est lue depuis Supabase Vault (chiffré, accessible aux
-- jobs pg_cron qui tournent en postgres).
--
-- ⚠️ ACTION MANUELLE REQUISE (une fois, AVANT que cette migration ait un effet
-- utile) — créer le secret dans Vault via le SQL editor (valeur dans Lovable
-- Cloud → Secrets → BOT_API_KEY ; ne JAMAIS la committer) :
--
--   SELECT vault.create_secret('<valeur de BOT_API_KEY>', 'bot_api_key');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Supprimer le doublon.
DO $do$
BEGIN
  PERFORM cron.unschedule('paladium-sync-listings');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;

-- 2) Re-scheduler TOUS les jobs HTTP avec le header lu depuis Vault.
--    (Mêmes schedules qu'avant ; URL unifiée sur project--<id>.lovable.app.)

DO $do$
BEGIN
  PERFORM cron.unschedule('generate-weekly-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'generate-weekly-digest',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/generate-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('paladium-admin-shop-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'paladium-admin-shop-sync',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-admin-shop-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('paladium-market-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'paladium-market-sync',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-market-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('paladium-status-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'paladium-status-sync',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-status-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('process-application-reviews');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'process-application-reviews',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/process-application-reviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('run-automation');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'run-automation',
  '27 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/run-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('salary-preview-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'salary-preview-weekly',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/generate-salary-preview',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('scan-anomalies');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'scan-anomalies',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/scan-anomalies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3) Les 3 jobs qui utilisaient l'ancien pattern GUC passent aussi sur Vault.

DO $do$
BEGIN
  PERFORM cron.unschedule('paladium-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'paladium-sync',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('import-mc-stats');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'import-mc-stats',
  '23 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/import-mc-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

DO $do$
BEGIN
  PERFORM cron.unschedule('sync-discord-presence');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;
SELECT cron.schedule(
  'sync-discord-presence',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/sync-discord-presence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
