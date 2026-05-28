
-- =====================================================
-- PunkAstik / Paladium — schéma complet
-- Auth: Discord OAuth via cookies sessions (pas Supabase Auth)
-- Toutes les permissions vérifiées côté server functions
-- =====================================================

-- MEMBERS
CREATE TABLE public.members (
  discord_id TEXT PRIMARY KEY,
  discord_username TEXT,
  ig_name TEXT,
  avatar_url TEXT,
  arrival_date DATE,
  recruiter_discord_id TEXT,
  last_rankup DATE,
  current_grade TEXT,
  astik_points INTEGER NOT NULL DEFAULT 0,
  messages_total INTEGER NOT NULL DEFAULT 0,
  messages_7d INTEGER NOT NULL DEFAULT 0,
  voice_total_seconds INTEGER NOT NULL DEFAULT 0,
  voice_7d_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active | former
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
-- No policies: access only via service_role from server functions.

-- MEMBER ALTS (doubles comptes)
CREATE TABLE public.member_alts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id TEXT NOT NULL REFERENCES public.members(discord_id) ON DELETE CASCADE,
  alt_discord_id TEXT,
  alt_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_alts_member ON public.member_alts(member_discord_id);
GRANT ALL ON public.member_alts TO service_role;
ALTER TABLE public.member_alts ENABLE ROW LEVEL SECURITY;

-- POINTS LEDGER (historique AstikPoints)
CREATE TABLE public.points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id TEXT NOT NULL REFERENCES public.members(discord_id) ON DELETE CASCADE,
  staff_discord_id TEXT NOT NULL,
  staff_username TEXT,
  amount INTEGER NOT NULL,            -- +/- delta appliqué
  reason TEXT,
  bonus_pct NUMERIC(5,2) DEFAULT 0,   -- bonus tag serveur appliqué
  total_after INTEGER NOT NULL,
  action_type TEXT NOT NULL,          -- add | remove | set | donation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_points_ledger_member ON public.points_ledger(member_discord_id, created_at DESC);
GRANT ALL ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- CONFIG VALUES (items, actions, autres, argent)
CREATE TABLE public.config_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- item | action | other | money
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  tier INTEGER,            -- palier (uniquement money)
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_values_cat ON public.config_values(category, display_order);
GRANT ALL ON public.config_values TO service_role;
ALTER TABLE public.config_values ENABLE ROW LEVEL SECURITY;

-- DONATIONS (paniers)
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active', -- active | validated | cancelled | expired
  staff_discord_id TEXT NOT NULL,
  staff_username TEXT,
  member_discord_id TEXT REFERENCES public.members(discord_id) ON DELETE SET NULL,
  total_brut INTEGER NOT NULL DEFAULT 0,
  bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_final INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  validated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_donations_status ON public.donations(status, expires_at);
CREATE INDEX idx_donations_member ON public.donations(member_discord_id, created_at DESC);
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- DONATION LINES
CREATE TABLE public.donation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL,    -- item | action | other | money
  config_value_id UUID REFERENCES public.config_values(id) ON DELETE SET NULL,
  label TEXT NOT NULL,        -- snapshot du nom
  unit_points INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_donation_lines_donation ON public.donation_lines(donation_id);
GRANT ALL ON public.donation_lines TO service_role;
ALTER TABLE public.donation_lines ENABLE ROW LEVEL SECURITY;

-- NOTES
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id TEXT NOT NULL REFERENCES public.members(discord_id) ON DELETE CASCADE,
  staff_discord_id TEXT NOT NULL,
  staff_username TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_member ON public.notes(member_discord_id, created_at DESC);
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- WARNINGS
CREATE TABLE public.warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id TEXT NOT NULL REFERENCES public.members(discord_id) ON DELETE CASCADE,
  staff_discord_id TEXT NOT NULL,
  staff_username TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_warnings_member ON public.warnings(member_discord_id, created_at DESC);
GRANT ALL ON public.warnings TO service_role;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

-- OBJECTIVES (V12)
CREATE TABLE public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  done_by_discord_id TEXT,
  done_at TIMESTAMPTZ,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.objectives TO service_role;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

-- LOGS
CREATE TABLE public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info',  -- info | warn | error
  action TEXT NOT NULL,
  actor_discord_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_created ON public.logs(created_at DESC);
CREATE INDEX idx_logs_level ON public.logs(level, created_at DESC);
GRANT ALL ON public.logs TO service_role;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- DISCORD ROLE CACHE (réduit les appels API Discord)
CREATE TABLE public.discord_role_cache (
  discord_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  role_ids TEXT[] NOT NULL DEFAULT '{}',
  nickname TEXT,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (discord_id, guild_id)
);
GRANT ALL ON public.discord_role_cache TO service_role;
ALTER TABLE public.discord_role_cache ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_members_updated     BEFORE UPDATE ON public.members        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_config_updated      BEFORE UPDATE ON public.config_values  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_donations_updated   BEFORE UPDATE ON public.donations      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_objectives_updated  BEFORE UPDATE ON public.objectives     FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
