-- Backlog : stats Paladium (faction actuelle, niveau, activité) récupérées à la
-- demande depuis la page (bouton), pour prioriser les joueurs encore actifs.
ALTER TABLE public.legacy_applications
  ADD COLUMN IF NOT EXISTS paladium_status text,        -- null | 'found' | 'not_found' | 'error'
  ADD COLUMN IF NOT EXISTS paladium_faction text,
  ADD COLUMN IF NOT EXISTS paladium_level integer,
  ADD COLUMN IF NOT EXISTS paladium_first_join text,
  ADD COLUMN IF NOT EXISTS paladium_last_seen text,
  ADD COLUMN IF NOT EXISTS paladium_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_legacy_apps_paladium_checked
  ON public.legacy_applications (paladium_checked_at)
  WHERE paladium_checked_at IS NULL;
