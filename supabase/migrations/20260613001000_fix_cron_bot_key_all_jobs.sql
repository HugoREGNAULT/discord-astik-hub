-- Répare les crons HTTP morts depuis le durcissement requireBotAuth (31 mai).
--
-- Constat (audit prod 2026-06-13) :
--   - Le GUC `app.bot_api_key` n'a JAMAIS été configuré (et le rôle du SQL
--     editor n'a pas le droit de faire ALTER DATABASE ... SET → impossible à
--     poser) → les 3 jobs qui l'utilisaient envoyaient un header null → 401.
--   - 8 autres jobs n'envoyaient AUCUNE clé → 401 silencieux aussi.
--   - pg_net affiche "succeeded" même sur un 401 (il ne lit pas la réponse),
--     d'où des semaines de pannes invisibles.
--   - Doublon : `paladium-sync-listings` tapait la même URL que `paladium-sync`.
--   - Timeout pg_net par défaut (5 s) trop court pour les hooks lents
--     (paladium-sync ≈ 15-20 s pour 30 joueurs) → traitement coupé en vol.
--
-- Correctifs : clé lue depuis Supabase Vault + timeout 60 s (hooks lents) /
-- 30 s (hooks fréquents).
--
-- ⚠️ ACTION MANUELLE REQUISE (une fois, AVANT que cette migration ait un effet
-- utile) — créer le secret dans Vault via le SQL editor (valeur dans Lovable
-- Cloud → Secrets → BOT_API_KEY ; ne JAMAIS la committer) :
--
--   SELECT vault.create_secret('<valeur de BOT_API_KEY>', 'bot_api_key');
--
-- (Fait en prod le 2026-06-13.)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Supprimer le job doublon.
DO $do$
BEGIN
  PERFORM cron.unschedule('paladium-sync-listings');
EXCEPTION WHEN OTHERS THEN NULL;
END$do$;


DO $do$ BEGIN PERFORM cron.unschedule('paladium-sync'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('paladium-sync', '*/10 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('process-application-reviews'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('process-application-reviews', '*/10 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/process-application-reviews',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('import-mc-stats'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('import-mc-stats', '23 */6 * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/import-mc-stats',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('generate-weekly-digest'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('generate-weekly-digest', '0 8 * * 1', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/generate-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('salary-preview-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('salary-preview-weekly', '0 12 * * 1', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/generate-salary-preview',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('run-automation'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('run-automation', '27 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/run-automation',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('scan-anomalies'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('scan-anomalies', '17 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/scan-anomalies',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('sync-discord-presence'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('sync-discord-presence', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/sync-discord-presence',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('paladium-status-sync'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('paladium-status-sync', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-status-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('paladium-admin-shop-sync'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('paladium-admin-shop-sync', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-admin-shop-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000) AS request_id;
$$);

DO $do$ BEGIN PERFORM cron.unschedule('paladium-market-sync'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('paladium-market-sync', '7 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-market-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000) AS request_id;
$$);
