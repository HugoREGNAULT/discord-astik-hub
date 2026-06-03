-- Refonte du formulaire de candidature (nouveau questionnaire 2026-06).
--
-- AJOUTE les nouveaux champs et ASSOUPLIT (nullable) les anciens qui ne sont
-- plus collectés. Rien n'est supprimé : les anciennes candidatures restent
-- intégralement lisibles côté recruteur.
--
-- À appliquer via le SQL Editor (Lovable Cloud). Idempotent.

-- 1) Nouvelles colonnes
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS presentation_gaming text,
  ADD COLUMN IF NOT EXISTS objectives          text,
  ADD COLUMN IF NOT EXISTS motivation          text,
  ADD COLUMN IF NOT EXISTS additional_info     text,
  ADD COLUMN IF NOT EXISTS pvp_level           integer,
  ADD COLUMN IF NOT EXISTS form_rating         numeric(2,1);

-- 2) Contraintes de bornes (idempotent : on retire avant d'ajouter)
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_pvp_level_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_pvp_level_check
  CHECK (pvp_level IS NULL OR pvp_level BETWEEN 1 AND 10);

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_form_rating_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_form_rating_check
  CHECK (form_rating IS NULL OR (form_rating BETWEEN 0.5 AND 5 AND (form_rating * 2) = floor(form_rating * 2)));

-- 3) Anciens champs : plus collectés -> nullable (données existantes conservées)
ALTER TABLE public.applications
  ALTER COLUMN weekly_playtime DROP NOT NULL,
  ALTER COLUMN first_version   DROP NOT NULL,
  ALTER COLUMN ig_grade        DROP NOT NULL,
  ALTER COLUMN skills          DROP NOT NULL,
  ALTER COLUMN knowledge_level DROP NOT NULL;
