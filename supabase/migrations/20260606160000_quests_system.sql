-- Système de quêtes hebdomadaires : templates (def. staff) + périodes (rotation hebdo)
-- + réclamations de récompense. À appliquer dans le SQL Editor Supabase AVANT le Publish.

-- 1) Templates de quêtes, gérés par le staff (quests.manage)
CREATE TABLE IF NOT EXISTS public.quest_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  quest_type text NOT NULL
    CHECK (quest_type IN ('messages', 'voice_hours', 'donation_points', 'points_earned')),
  target_value integer NOT NULL CHECK (target_value > 0),
  reward_points integer NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Périodes hebdomadaires (créées à la volée par l'app + cron optionnel ci-dessous)
CREATE TABLE IF NOT EXISTS public.quest_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on date NOT NULL UNIQUE,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Réclamations : 1 récompense max par membre / quête / période
CREATE TABLE IF NOT EXISTS public.member_quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.quest_periods(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.quest_templates(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  reward_points integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, template_id, member_discord_id)
);
CREATE INDEX IF NOT EXISTS idx_quest_claims_member ON public.member_quest_claims(member_discord_id);

-- 4) Étendre le CHECK de points_ledger.action_type pour 'quest_reward'
--    SANS casser les valeurs existantes (certaines, ex 'objective'/'salary', ont été
--    ajoutées hors dépôt) : on reconstruit la liste à partir des valeurs réelles en base.
DO $$
DECLARE vals text;
BEGIN
  SELECT string_agg(v, ', ') INTO vals FROM (
    SELECT DISTINCT quote_literal(action_type) AS v FROM public.points_ledger
    UNION
    SELECT quote_literal(x) FROM unnest(
      ARRAY['add', 'remove', 'set', 'donation', 'objective', 'salary', 'quest_reward']
    ) AS x
  ) s;
  EXECUTE 'ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_action_type_check';
  EXECUTE 'ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_action_type_check'
        || ' CHECK (action_type IN (' || vals || '))';
END $$;

-- 5) RLS : tout passe par les server functions (clé service_role). Aucune policy (deny par défaut).
GRANT ALL ON public.quest_templates, public.quest_periods, public.member_quest_claims TO service_role;
ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_quest_claims ENABLE ROW LEVEL SECURITY;

-- 6) (Optionnel) rotation auto via pg_cron — la période est DÉJÀ créée à la volée côté app,
--    ce cron n'est qu'un filet. À décommenter si pg_cron est disponible :
-- SELECT cron.schedule('ensure-quest-period-weekly', '5 0 * * 1',
--   $$INSERT INTO public.quest_periods (starts_on, ends_on)
--     VALUES (date_trunc('week', now())::date, date_trunc('week', now())::date + 7)
--     ON CONFLICT (starts_on) DO NOTHING$$);
