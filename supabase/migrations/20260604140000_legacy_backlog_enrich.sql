-- Enrichissements du backlog : 4e statut 'already_member' + résultats Mojang.
-- À appliquer via le SQL Editor (Lovable Cloud).

-- 1) Nouveau statut "déjà membre"
ALTER TABLE public.legacy_applications DROP CONSTRAINT IF EXISTS legacy_applications_contact_status_check;
ALTER TABLE public.legacy_applications
  ADD CONSTRAINT legacy_applications_contact_status_check
  CHECK (contact_status IN ('to_contact', 'contacted', 'do_not_contact', 'already_member'));

-- 2) Résultat de la vérification Mojang (rempli à la demande depuis la page)
ALTER TABLE public.legacy_applications
  ADD COLUMN IF NOT EXISTS mojang_status text,          -- null = pas vérifié | 'valid' | 'not_found'
  ADD COLUMN IF NOT EXISTS mojang_uuid text,            -- UUID si le pseudo existe encore
  ADD COLUMN IF NOT EXISTS mojang_current_name text,    -- casse exacte du pseudo actuel
  ADD COLUMN IF NOT EXISTS mojang_checked_at timestamptz;
