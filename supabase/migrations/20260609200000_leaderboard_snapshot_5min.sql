-- Passe le snapshot du classement de TOUTES LES HEURES à TOUTES LES 5 MINUTES.
-- Avec un snapshot horaire et ~6h d'historique, le graphe n'avait que ~6 points
-- et les courbes étaient en escalier grossier.
-- Avec 5 min : 12 points/heure, 288/jour -> courbes lisses, graphe exploitable
-- en vue 24h/7j dès le lendemain.
--
-- Coût : 50 membres × 288/j = ~14 400 lignes/jour (acceptable).
-- La table conserve 30j d'historique (20 000 lignes max dans getLeaderboardHistory).
--
-- Idempotent (unschedule + schedule).
DO $$
BEGIN
  PERFORM cron.unschedule('capture-leaderboard-snapshot');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'capture-leaderboard-snapshot',
  '*/5 * * * *',
  $$ SELECT public.capture_leaderboard_snapshot(); $$
);
