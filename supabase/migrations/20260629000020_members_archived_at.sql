-- Horodatage d'archivage (distinct de status).
-- La colonne status existante ('active' | 'former') reste la source de vérité
-- pour le filtrage ; archived_at enregistre quand le passage à 'former' a eu
-- lieu lors d'une synchro Discord.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
