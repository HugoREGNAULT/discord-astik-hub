
-- =============== grade_thresholds ===============
CREATE TABLE public.grade_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_label text NOT NULL UNIQUE,
  display_order int NOT NULL,
  min_points int NOT NULL DEFAULT 0,
  min_days_in_faction int NOT NULL DEFAULT 0,
  min_messages_7d int NOT NULL DEFAULT 0,
  min_voice_7d_seconds int NOT NULL DEFAULT 0,
  min_days_since_rankup int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.grade_thresholds TO authenticated;
GRANT ALL ON public.grade_thresholds TO service_role;

ALTER TABLE public.grade_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_thresholds readable by authenticated"
  ON public.grade_thresholds FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_grade_thresholds_touch
  BEFORE UPDATE ON public.grade_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== badges ===============
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  auto_rule jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges readable by authenticated"
  ON public.badges FOR SELECT TO authenticated USING (true);

-- =============== member_badges ===============
CREATE TABLE public.member_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_by_discord_id text,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_discord_id, badge_id)
);

CREATE INDEX idx_member_badges_member ON public.member_badges(member_discord_id);

GRANT SELECT ON public.member_badges TO authenticated;
GRANT ALL ON public.member_badges TO service_role;

ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_badges readable by authenticated"
  ON public.member_badges FOR SELECT TO authenticated USING (true);

-- =============== Seeds ===============
INSERT INTO public.grade_thresholds (grade_label, display_order, min_points, min_days_in_faction, min_messages_7d, min_voice_7d_seconds, min_days_since_rankup) VALUES
  ('Bleu',         1,      0,   0,   0,     0, 0),
  ('Soldat',       2,    500,   7,  20,  1800, 0),
  ('Caporal',      3,   2000,  21,  50,  3600, 7),
  ('Sergent',      4,   5000,  45, 100,  7200, 14),
  ('Recruteur',    5,  10000,  60, 150, 10800, 21),
  ('Adjudant',     6,  20000,  90, 200, 14400, 30),
  ('Major',        7,  40000, 120, 250, 18000, 30),
  ('Aspirant',     8,  70000, 150, 300, 21600, 45),
  ('Lieutenant',   9, 120000, 180, 350, 25200, 60),
  ('Bras droits', 10, 200000, 240, 400, 28800, 90),
  ('Leader',      11, 500000, 365, 500, 36000, 120);

INSERT INTO public.badges (code, name, description, icon, color, auto_rule) VALUES
  ('whale_100k',   'Baleine',     'Atteint 100 000 AstikPoints',          '🐋', '#3b82f6', '{"metric":"astik_points","gte":100000}'::jsonb),
  ('veteran_1y',   'Vétéran',     '1 an dans la faction',                  '🎖️', '#f59e0b', NULL),
  ('voice_addict', 'Voice Addict','10h de vocal sur 7 jours',              '🎙️', '#ec4899', '{"metric":"voice_7d_seconds","gte":36000}'::jsonb);
