-- Uptime serveurs (/tools/uptime) : statut brut par serveur + cadence 1 min.
--
-- Constat (audit 2026-07-02) :
--   - Le cron paladium-status-sync existait déjà et tournait réellement
--     (pg_cron + pg_net, pas dépendant d'un visiteur) mais à 5 min — trop
--     grossier pour des coupures de type restart/whitelist qui durent souvent
--     moins de 5 min : elles tombaient entre deux relevés et n'étaient jamais
--     enregistrées.
--   - paladium_server_status_history ne stockait qu'un booléen is_online
--     dérivé, jamais le texte de statut brut (running/offline/starting/
--     restart/stopping/whitelist/unknown).
--
-- ⚠️ ACTION MANUELLE REQUISE — coller ce fichier dans le SQL editor Supabase
-- (Lovable Cloud), comme pour les migrations précédentes. Le secret Vault
-- `bot_api_key` doit déjà exister (posé le 2026-06-13, cf.
-- 20260613001000_fix_cron_bot_key_all_jobs.sql) — rien à refaire dessus.
--
-- Vérification après application :
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'paladium-status-sync';
--   SELECT max(captured_at) FROM public.paladium_server_status_history;
--   -- max(captured_at) doit rester à moins de ~2 min de now() en continu.

ALTER TABLE public.paladium_server_status_history
  ADD COLUMN IF NOT EXISTS status text;

COMMENT ON COLUMN public.paladium_server_status_history.status IS
  'Texte brut renvoyé par /v1/status pour ce serveur (running/offline/starting/restart/stopping/whitelist/unknown/online). is_online en est dérivé à l''insertion (UP seulement si running/online).';

DO $do$ BEGIN PERFORM cron.unschedule('paladium-status-sync'); EXCEPTION WHEN OTHERS THEN NULL; END$do$;
SELECT cron.schedule('paladium-status-sync', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://project--ef9e0d95-9980-4550-bd4b-e772a54f1e82.lovable.app/api/public/hooks/paladium-status-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-bot-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bot_api_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000) AS request_id;
$$);
