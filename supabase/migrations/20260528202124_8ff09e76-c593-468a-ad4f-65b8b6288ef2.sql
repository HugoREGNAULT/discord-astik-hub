-- Activer RLS sur toutes les tables publiques
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_alts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_role_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Révoquer tous les privilèges des rôles anon et authenticated
-- (le service_role bypass RLS donc les serverFn continueront de fonctionner)
REVOKE ALL ON public.applications FROM anon, authenticated;
REVOKE ALL ON public.members FROM anon, authenticated;
REVOKE ALL ON public.member_alts FROM anon, authenticated;
REVOKE ALL ON public.donations FROM anon, authenticated;
REVOKE ALL ON public.donation_lines FROM anon, authenticated;
REVOKE ALL ON public.points_ledger FROM anon, authenticated;
REVOKE ALL ON public.notes FROM anon, authenticated;
REVOKE ALL ON public.warnings FROM anon, authenticated;
REVOKE ALL ON public.config_values FROM anon, authenticated;
REVOKE ALL ON public.objectives FROM anon, authenticated;
REVOKE ALL ON public.polls FROM anon, authenticated;
REVOKE ALL ON public.poll_options FROM anon, authenticated;
REVOKE ALL ON public.poll_votes FROM anon, authenticated;
REVOKE ALL ON public.discord_role_cache FROM anon, authenticated;
REVOKE ALL ON public.logs FROM anon, authenticated;

-- S'assurer que le service_role garde tous les droits (par sécurité)
GRANT ALL ON public.applications TO service_role;
GRANT ALL ON public.members TO service_role;
GRANT ALL ON public.member_alts TO service_role;
GRANT ALL ON public.donations TO service_role;
GRANT ALL ON public.donation_lines TO service_role;
GRANT ALL ON public.points_ledger TO service_role;
GRANT ALL ON public.notes TO service_role;
GRANT ALL ON public.warnings TO service_role;
GRANT ALL ON public.config_values TO service_role;
GRANT ALL ON public.objectives TO service_role;
GRANT ALL ON public.polls TO service_role;
GRANT ALL ON public.poll_options TO service_role;
GRANT ALL ON public.poll_votes TO service_role;
GRANT ALL ON public.discord_role_cache TO service_role;
GRANT ALL ON public.logs TO service_role;