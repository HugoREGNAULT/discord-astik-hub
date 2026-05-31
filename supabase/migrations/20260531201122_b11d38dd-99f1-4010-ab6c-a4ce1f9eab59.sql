-- Salary grades : barème de paie par grade
CREATE TABLE public.salary_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_label text NOT NULL UNIQUE,
  weekly_points integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  min_activity_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.salary_grades TO authenticated;
GRANT ALL ON public.salary_grades TO service_role;

ALTER TABLE public.salary_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_grades readable by authenticated"
  ON public.salary_grades FOR SELECT TO authenticated USING (true);

CREATE TRIGGER touch_salary_grades_updated_at
  BEFORE UPDATE ON public.salary_grades
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Salary runs : lots de versement
CREATE TABLE public.salary_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'preview',
  total_points integer NOT NULL DEFAULT 0,
  recipient_count integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_discord_id text,
  created_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  CONSTRAINT salary_runs_status_check CHECK (status IN ('preview','committed','cancelled'))
);

CREATE UNIQUE INDEX salary_runs_one_committed_per_period
  ON public.salary_runs(period_start) WHERE status = 'committed';

CREATE INDEX idx_salary_runs_period_start ON public.salary_runs(period_start DESC);

GRANT SELECT ON public.salary_runs TO authenticated;
GRANT ALL ON public.salary_runs TO service_role;

ALTER TABLE public.salary_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_runs readable by authenticated"
  ON public.salary_runs FOR SELECT TO authenticated USING (true);

-- Seed : barème avec les labels EFFECTIF_GRADES, weekly_points croissants
INSERT INTO public.salary_grades (grade_label, weekly_points, min_activity_seconds) VALUES
  ('Bleu',        50,    0),
  ('Soldat',      150,   0),
  ('Caporal',     250,   0),
  ('Sergent',     400,   0),
  ('Recruteur',   500,   0),
  ('Adjudant',    600,   0),
  ('Major',       750,   0),
  ('Aspirant',    900,   0),
  ('Lieutenant',  1100,  0),
  ('Bras droits', 1400,  0),
  ('Leader',      1800,  0)
ON CONFLICT (grade_label) DO NOTHING;
