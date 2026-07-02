ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paladium_player_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.projects FROM anon, authenticated;
REVOKE ALL ON public.project_materials FROM anon, authenticated;
REVOKE ALL ON public.project_contributions FROM anon, authenticated;
REVOKE ALL ON public.paladium_player_cache FROM anon, authenticated;

GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.project_materials TO service_role;
GRANT ALL ON public.project_contributions TO service_role;
GRANT ALL ON public.paladium_player_cache TO service_role;