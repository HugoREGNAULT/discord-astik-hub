-- 1) Rôle lecture seule pour Grafana
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader') THEN
    CREATE ROLE grafana_reader LOGIN PASSWORD 'FjRNmclCtNRtJf0ojpALKfptIRbxIa6u'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
      CONNECTION LIMIT 5;
  ELSE
    ALTER ROLE grafana_reader WITH LOGIN PASSWORD 'FjRNmclCtNRtJf0ojpALKfptIRbxIa6u'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
      CONNECTION LIMIT 5;
  END IF;
END$$;

-- 2) Accès schéma public en lecture uniquement
REVOKE ALL ON SCHEMA public FROM grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;

-- Grants ciblés (on n'utilise pas GRANT SELECT ON ALL TABLES pour éviter d'exposer
-- d'éventuelles tables sensibles ajoutées plus tard sans réflexion).
GRANT SELECT ON public.members              TO grafana_reader;
GRANT SELECT ON public.leaderboard_snapshots TO grafana_reader;
GRANT SELECT ON public.points_ledger        TO grafana_reader;
GRANT SELECT ON public.donations            TO grafana_reader;
GRANT SELECT ON public.donation_lines       TO grafana_reader;
GRANT SELECT ON public.applications         TO grafana_reader;
GRANT SELECT ON public.warnings             TO grafana_reader;
GRANT SELECT ON public.absences             TO grafana_reader;
GRANT SELECT ON public.polls                TO grafana_reader;
GRANT SELECT ON public.poll_options         TO grafana_reader;
GRANT SELECT ON public.poll_votes           TO grafana_reader;
GRANT SELECT ON public.logs                 TO grafana_reader;
GRANT SELECT ON public.objectives           TO grafana_reader;
GRANT SELECT ON public.notes                TO grafana_reader;
GRANT SELECT ON public.member_alts          TO grafana_reader;
GRANT SELECT ON public.config_values        TO grafana_reader;
GRANT SELECT ON public.pdc_blocks           TO grafana_reader;
GRANT SELECT ON public.pdc_plans            TO grafana_reader;
GRANT SELECT ON public.discord_role_cache   TO grafana_reader;

-- 3) Vues d'agrégation pour Grafana

-- Évolution du classement (jointure snapshots + nom lisible)
CREATE OR REPLACE VIEW public.v_leaderboard_timeseries AS
SELECT
  s.taken_at,
  s.discord_id,
  COALESCE(m.ig_name, m.discord_username, s.discord_id) AS display_name,
  m.current_grade,
  s.astik_points,
  s.voice_total_seconds,
  s.voice_7d_seconds,
  s.messages_total,
  s.messages_7d
FROM public.leaderboard_snapshots s
LEFT JOIN public.members m ON m.discord_id = s.discord_id;

-- Points distribués par jour
CREATE OR REPLACE VIEW public.v_points_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  action_type,
  staff_discord_id,
  staff_username,
  SUM(amount)::int AS total_amount,
  COUNT(*)::int    AS tx_count
FROM public.points_ledger
GROUP BY 1, 2, 3, 4;

-- Activité staff par jour (volumes consolidés)
CREATE OR REPLACE VIEW public.v_staff_activity_daily AS
SELECT day, 'donation'::text   AS kind, staff_discord_id, staff_username, COUNT(*)::int AS n
FROM (
  SELECT date_trunc('day', created_at) AS day, staff_discord_id, staff_username
  FROM public.donations
) d GROUP BY 1, 3, 4
UNION ALL
SELECT day, 'warning'::text, staff_discord_id, staff_username, COUNT(*)::int
FROM (
  SELECT date_trunc('day', created_at) AS day, staff_discord_id, staff_username
  FROM public.warnings
) w GROUP BY 1, 3, 4
UNION ALL
SELECT day, 'application_decided'::text, decided_by_discord_id, decided_by_username, COUNT(*)::int
FROM (
  SELECT date_trunc('day', decided_at) AS day, decided_by_discord_id, decided_by_username
  FROM public.applications
  WHERE decided_at IS NOT NULL
) a GROUP BY 1, 3, 4;

GRANT SELECT ON public.v_leaderboard_timeseries TO grafana_reader;
GRANT SELECT ON public.v_points_daily           TO grafana_reader;
GRANT SELECT ON public.v_staff_activity_daily   TO grafana_reader;

-- 4) Default privileges : si on ajoute une vue/table publique plus tard,
-- elle ne sera PAS automatiquement visible par grafana_reader. C'est volontaire.
-- Pour exposer une nouvelle table, il faudra GRANT SELECT explicite.