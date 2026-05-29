CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discord_id TEXT NOT NULL,
  astik_points NUMERIC(14,4) NOT NULL DEFAULT 0,
  voice_total_seconds INTEGER NOT NULL DEFAULT 0,
  voice_7d_seconds INTEGER NOT NULL DEFAULT 0,
  messages_total INTEGER NOT NULL DEFAULT 0,
  messages_7d INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS leaderboard_snapshots_taken_at_idx ON public.leaderboard_snapshots(taken_at DESC);
CREATE INDEX IF NOT EXISTS leaderboard_snapshots_discord_id_idx ON public.leaderboard_snapshots(discord_id, taken_at DESC);

GRANT SELECT, INSERT ON public.leaderboard_snapshots TO authenticated;
GRANT ALL ON public.leaderboard_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.leaderboard_snapshots_id_seq TO authenticated, service_role;

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots readable by all authenticated"
  ON public.leaderboard_snapshots FOR SELECT TO authenticated USING (true);

-- Fonction de capture
CREATE OR REPLACE FUNCTION public.capture_leaderboard_snapshot()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.leaderboard_snapshots
    (discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d)
  SELECT discord_id, astik_points, voice_total_seconds, voice_7d_seconds, messages_total, messages_7d
  FROM public.members
  WHERE status = 'active';
$$;