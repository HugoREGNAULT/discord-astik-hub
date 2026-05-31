-- Liaison Minecraft <-> Discord par challenge avec code à usage unique.
-- Tables accédées exclusivement côté serveur (supabaseAdmin / service_role).
-- Aucun accès direct depuis le client : pas de grant authenticated/anon.

CREATE TABLE IF NOT EXISTS public.mc_link_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id   text NOT NULL,
  mc_name      text NOT NULL,
  mc_uuid      text,
  code         text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','verified','expired')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  verified_at  timestamptz
);

GRANT ALL ON public.mc_link_challenges TO service_role;

ALTER TABLE public.mc_link_challenges ENABLE ROW LEVEL SECURITY;
-- Pas de policy : seul service_role (qui by-pass RLS) y accède.

CREATE INDEX IF NOT EXISTS idx_mc_link_challenges_discord
  ON public.mc_link_challenges (discord_id, status, created_at DESC);

-- Un seul challenge pending par discord_id à la fois (le startMcLink fait DELETE
-- avant INSERT, donc ce n'est pas strict, mais on guarantit l'unicité du code actif).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mc_link_challenges_code_pending
  ON public.mc_link_challenges (code)
  WHERE status = 'pending';

-- Snapshots Paladium par membre, utilisés pour l'import continu et la
-- détection d'alts par corrélation.
CREATE TABLE IF NOT EXISTS public.mc_player_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mc_uuid         text NOT NULL,
  money           numeric,
  jobs            jsonb NOT NULL DEFAULT '[]'::jsonb,
  faction_ingame  text,
  raw             jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mc_player_stats TO authenticated;
GRANT ALL    ON public.mc_player_stats TO service_role;

ALTER TABLE public.mc_player_stats ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée à tout authenticated (utilisée par la fiche membre côté
-- members.view ; pas de données sensibles, ce sont des stats publiques Paladium).
CREATE POLICY "mc_player_stats readable by authenticated"
  ON public.mc_player_stats
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_mc_player_stats_uuid_recent
  ON public.mc_player_stats (mc_uuid, snapshot_at DESC);