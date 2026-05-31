-- =====================================
-- MODULE PROJETS
-- =====================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned',
  priority text NOT NULL DEFAULT 'normal',
  deadline date,
  owner_discord_id text,
  owner_username text,
  created_by_discord_id text NOT NULL,
  created_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects readable by authenticated" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.project_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  qty_needed numeric NOT NULL DEFAULT 0,
  qty_collected numeric NOT NULL DEFAULT 0,
  unit_points numeric,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_resources_project_idx ON public.project_resources(project_id);
GRANT SELECT ON public.project_resources TO authenticated;
GRANT ALL ON public.project_resources TO service_role;
ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_resources readable by authenticated" ON public.project_resources FOR SELECT TO authenticated USING (true);
CREATE TRIGGER project_resources_touch BEFORE UPDATE ON public.project_resources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.project_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.project_resources(id) ON DELETE SET NULL,
  member_discord_id text NOT NULL,
  member_username text,
  item_name text NOT NULL,
  quantity numeric NOT NULL,
  points_awarded numeric,
  note text,
  created_by_discord_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_contributions_project_idx ON public.project_contributions(project_id);
CREATE INDEX project_contributions_member_idx ON public.project_contributions(member_discord_id);
GRANT SELECT ON public.project_contributions TO authenticated;
GRANT ALL ON public.project_contributions TO service_role;
ALTER TABLE public.project_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_contributions readable by authenticated" ON public.project_contributions FOR SELECT TO authenticated USING (true);

-- =====================================
-- ÉVOLUTION MÉTIERS
-- =====================================
CREATE TABLE public.mc_jobs_snapshots (
  id bigserial PRIMARY KEY,
  mc_uuid text NOT NULL,
  member_discord_id text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  jobs jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX mc_jobs_snapshots_uuid_idx ON public.mc_jobs_snapshots(mc_uuid, captured_at DESC);
CREATE INDEX mc_jobs_snapshots_member_idx ON public.mc_jobs_snapshots(member_discord_id, captured_at DESC);
GRANT SELECT ON public.mc_jobs_snapshots TO authenticated;
GRANT ALL ON public.mc_jobs_snapshots TO service_role;
ALTER TABLE public.mc_jobs_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc_jobs_snapshots readable by authenticated" ON public.mc_jobs_snapshots FOR SELECT TO authenticated USING (true);