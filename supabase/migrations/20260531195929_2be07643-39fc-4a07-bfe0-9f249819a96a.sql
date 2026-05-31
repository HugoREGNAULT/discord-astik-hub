
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS trial_until timestamptz,
  ADD COLUMN IF NOT EXISTS mentor_discord_id text;

CREATE TABLE public.trial_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  voter_discord_id text NOT NULL,
  voter_username text,
  vote text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_discord_id, voter_discord_id)
);

GRANT SELECT ON public.trial_votes TO authenticated;
GRANT ALL ON public.trial_votes TO service_role;

ALTER TABLE public.trial_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trial_votes readable by authenticated"
  ON public.trial_votes FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_trial_votes_member ON public.trial_votes(member_discord_id);

CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  template_key text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_tasks readable by authenticated"
  ON public.onboarding_tasks FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_onboarding_tasks_member ON public.onboarding_tasks(member_discord_id);
