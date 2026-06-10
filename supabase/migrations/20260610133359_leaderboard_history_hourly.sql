-- Échantillonnage horaire de l'historique du classement.
--
-- Contexte : depuis le 2026-06-09, le job de snapshot écrit ~1 ligne/membre/5 min
-- (avant : ~1/heure). La lecture par `limit(20000)` ne couvrait alors plus que ~8 h
-- au lieu de plusieurs jours. On garde au plus 1 point par (membre, heure) : le volume
-- devient borné par la fenêtre temporelle, indépendamment du rythme d'écriture.
--
-- DISTINCT ON (membre, heure) + ORDER BY taken_at DESC => on conserve le snapshot
-- le plus récent de chaque heure pour chaque membre.
create or replace function public.leaderboard_history_hourly(p_since timestamptz)
returns setof public.leaderboard_snapshots
language sql
stable
as $$
  select distinct on (discord_id, date_trunc('hour', taken_at)) *
  from public.leaderboard_snapshots
  where taken_at >= p_since
  order by discord_id, date_trunc('hour', taken_at), taken_at desc;
$$;
