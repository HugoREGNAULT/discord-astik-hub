-- Planifie la capture HORAIRE d'un snapshot du classement.
--
-- public.capture_leaderboard_snapshot() (migration 20260529045255) insère une
-- ligne par membre actif dans public.leaderboard_snapshots, mais AUCUN
-- cron.schedule ne l'appelait -> la table restait figée (depuis 2026-05-30) et
-- le graphique d'évolution du dashboard /dashboard ("Classement") n'avançait
-- plus ("dernière actualisation · il y a 3j").
--
-- Ce cron horaire ré-alimente l'historique. NB : ce cron ne fait que
-- PHOTOGRAPHIER l'état courant de public.members ; les VALEURS proviennent
-- d'ailleurs : messages_* et voice_* via le bot Discord externe
-- (POST /api/public/bot/*), astik_points via le trigger SQL sur points_ledger.
-- Sans ces sources, les snapshots restent à 0.
--
-- À appliquer aussi côté Lovable Cloud via le SQL Editor (un push GitHub
-- n'exécute pas forcément la migration). Idempotent (unschedule + schedule).
DO $$
BEGIN
  PERFORM cron.unschedule('capture-leaderboard-snapshot');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'capture-leaderboard-snapshot',
  '0 * * * *',                                    -- toutes les heures, à l'heure pile
  $$ SELECT public.capture_leaderboard_snapshot(); $$
);
