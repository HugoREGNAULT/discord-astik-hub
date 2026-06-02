
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'schedule',
  ADD COLUMN IF NOT EXISTS question_mode text;

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_kind_chk,
  ADD CONSTRAINT polls_kind_chk CHECK (kind IN ('schedule','question'));

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_question_mode_chk,
  ADD CONSTRAINT polls_question_mode_chk CHECK (question_mode IS NULL OR question_mode IN ('yes_no','yes_no_maybe'));

ALTER TABLE public.poll_options
  ALTER COLUMN starts_at DROP NOT NULL,
  ALTER COLUMN duration_minutes DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS label text;
