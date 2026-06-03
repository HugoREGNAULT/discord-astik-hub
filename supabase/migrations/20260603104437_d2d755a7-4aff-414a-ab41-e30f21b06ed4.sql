ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS interview_validated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS interview_validated_by_discord_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS interview_validated_by_username TEXT NULL;