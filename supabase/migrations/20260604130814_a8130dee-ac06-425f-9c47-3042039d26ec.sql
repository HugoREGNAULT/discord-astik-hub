ALTER TABLE public.legacy_applications
  ADD COLUMN IF NOT EXISTS mojang_status text,
  ADD COLUMN IF NOT EXISTS mojang_uuid text,
  ADD COLUMN IF NOT EXISTS mojang_current_name text,
  ADD COLUMN IF NOT EXISTS mojang_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS legacy_applications_mojang_checked_at_idx
  ON public.legacy_applications (mojang_checked_at)
  WHERE mojang_checked_at IS NULL;

CREATE INDEX IF NOT EXISTS legacy_applications_mojang_uuid_idx
  ON public.legacy_applications (mojang_uuid)
  WHERE mojang_uuid IS NOT NULL;