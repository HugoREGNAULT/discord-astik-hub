-- Rétention multi-résolution (downsampling type RRDtool) de l'historique du classement.
--
-- Problème : depuis le 2026-06-09 la fine est écrite toutes les 5 min (~55k lignes/j).
-- Garder cette résolution sur 30 j = des millions de lignes inutiles.
--
-- Solution : 3 tiers, chacun purgé pour borner le volume. Chaque vue lit son tier.
--   - leaderboard_snapshots      (fine, 5 min) -> rétention 48h  -> vue 24h
--   - leaderboard_snapshots_2h   (2 h)         -> rétention 14j  -> vue 7j
--   - leaderboard_snapshots_1d   (1 jour)      -> rétention 31j  -> vue 30j
--
-- Cascade fine -> 2h -> 1j : chaque rollup prend le DERNIER point de chaque bucket
-- (les métriques sont des totaux cumulés) et tourne AVANT la purge du tier au-dessus.
-- Marges de rétention (48h>24h, 14j>7j, 31j>30j) : la baseline « valeur au début de
-- la fenêtre » existe toujours.

-- 1) Tables de rollup (calquées sur la fine, + contrainte d'unicité par bucket).
create table if not exists public.leaderboard_snapshots_2h (
  id bigserial primary key,
  taken_at timestamptz not null,
  discord_id text not null,
  astik_points numeric(14,4) not null default 0,
  voice_total_seconds integer not null default 0,
  voice_7d_seconds integer not null default 0,
  messages_total integer not null default 0,
  messages_7d integer not null default 0,
  unique (discord_id, taken_at)
);
create index if not exists leaderboard_snapshots_2h_taken_at_idx
  on public.leaderboard_snapshots_2h(taken_at desc);

create table if not exists public.leaderboard_snapshots_1d (
  id bigserial primary key,
  taken_at timestamptz not null,
  discord_id text not null,
  astik_points numeric(14,4) not null default 0,
  voice_total_seconds integer not null default 0,
  voice_7d_seconds integer not null default 0,
  messages_total integer not null default 0,
  messages_7d integer not null default 0,
  unique (discord_id, taken_at)
);
create index if not exists leaderboard_snapshots_1d_taken_at_idx
  on public.leaderboard_snapshots_1d(taken_at desc);

alter table public.leaderboard_snapshots_2h enable row level security;
alter table public.leaderboard_snapshots_1d enable row level security;
drop policy if exists "snapshots_2h readable by authenticated" on public.leaderboard_snapshots_2h;
drop policy if exists "snapshots_1d readable by authenticated" on public.leaderboard_snapshots_1d;
create policy "snapshots_2h readable by authenticated"
  on public.leaderboard_snapshots_2h for select to authenticated using (true);
create policy "snapshots_1d readable by authenticated"
  on public.leaderboard_snapshots_1d for select to authenticated using (true);
grant select on public.leaderboard_snapshots_2h to authenticated;
grant select on public.leaderboard_snapshots_1d to authenticated;
grant all on public.leaderboard_snapshots_2h to service_role;
grant all on public.leaderboard_snapshots_1d to service_role;

-- 2) Rollup 2h (fine -> 2h) puis purge de la fine au-delà de 48h.
create or replace function public.rollup_leaderboard_2h()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.leaderboard_snapshots_2h
    (taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d)
  select distinct on (discord_id, bucket)
    bucket, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
  from (
    select s.*,
      date_trunc('hour', taken_at)
        - (extract(hour from taken_at)::int % 2) * interval '1 hour' as bucket
    from public.leaderboard_snapshots s
    where taken_at >= now() - interval '50 hours'
  ) q
  order by discord_id, bucket, taken_at desc
  on conflict (discord_id, taken_at) do update set
    astik_points = excluded.astik_points,
    voice_total_seconds = excluded.voice_total_seconds,
    voice_7d_seconds = excluded.voice_7d_seconds,
    messages_total = excluded.messages_total,
    messages_7d = excluded.messages_7d;

  delete from public.leaderboard_snapshots where taken_at < now() - interval '48 hours';
end$$;

-- 3) Rollup 1j (2h -> 1j) puis purges des tiers 2h (14j) et 1j (31j).
create or replace function public.rollup_leaderboard_1d()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.leaderboard_snapshots_1d
    (taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d)
  select distinct on (discord_id, day)
    day, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
  from (
    select s.*, date_trunc('day', taken_at) as day
    from public.leaderboard_snapshots_2h s
    where taken_at >= now() - interval '15 days'
  ) q
  order by discord_id, day, taken_at desc
  on conflict (discord_id, taken_at) do update set
    astik_points = excluded.astik_points,
    voice_total_seconds = excluded.voice_total_seconds,
    voice_7d_seconds = excluded.voice_7d_seconds,
    messages_total = excluded.messages_total,
    messages_7d = excluded.messages_7d;

  delete from public.leaderboard_snapshots_2h where taken_at < now() - interval '14 days';
  delete from public.leaderboard_snapshots_1d where taken_at < now() - interval '31 days';
end$$;

-- 4) Backfill initial depuis tout l'historique fin encore présent.
-- IMPORTANT : on n'appelle PAS rollup_leaderboard_2h() ici car il purgerait la fine
-- à 48h AVANT le backfill du tier 1j (qui a besoin des 30 j de fine). On fait des
-- INSERT directs sur toute la fine ; la 1re exécution cron purgera la fine plus tard,
-- une fois 2h et 1j déjà peuplés.
insert into public.leaderboard_snapshots_2h
  (taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d)
select distinct on (discord_id, bucket)
  bucket, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
from (
  select s.*,
    date_trunc('hour', taken_at)
      - (extract(hour from taken_at)::int % 2) * interval '1 hour' as bucket
  from public.leaderboard_snapshots s
) q
order by discord_id, bucket, taken_at desc
on conflict (discord_id, taken_at) do nothing;

insert into public.leaderboard_snapshots_1d
  (taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d)
select distinct on (discord_id, day)
  day, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
from (
  select s.*, date_trunc('day', taken_at) as day
  from public.leaderboard_snapshots s
) q
order by discord_id, day, taken_at desc
on conflict (discord_id, taken_at) do nothing;

-- 5) RPC de lecture routée par période (remplace leaderboard_history_hourly).
drop function if exists public.leaderboard_history_hourly(timestamptz);
create or replace function public.leaderboard_history(p_period text)
returns setof public.leaderboard_snapshots
language sql stable as $$
  select id, taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
  from public.leaderboard_snapshots
  where p_period = '24h' and taken_at >= now() - interval '24 hours'
  union all
  select id, taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
  from public.leaderboard_snapshots_2h
  where p_period = '7d' and taken_at >= now() - interval '7 days'
  union all
  select id, taken_at, discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
  from public.leaderboard_snapshots_1d
  where p_period in ('30d', 'all') and taken_at >= now() - interval '30 days';
$$;

-- 6) Planification pg_cron des rollups (idempotent : unschedule + schedule).
DO $$ BEGIN PERFORM cron.unschedule('rollup-leaderboard-2h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('rollup-leaderboard-1d'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
select cron.schedule('rollup-leaderboard-2h', '0 */2 * * *', $$ select public.rollup_leaderboard_2h(); $$);
select cron.schedule('rollup-leaderboard-1d', '5 0 * * *',   $$ select public.rollup_leaderboard_1d(); $$);
