-- Backlog des anciennes candidatures (import CSV multi-factions / multi-formulaires).
-- Interface de suivi de contact réservée au haut staff (admin.access).
-- À appliquer via le SQL Editor (Lovable Cloud) AVANT l'import des données.

CREATE TABLE IF NOT EXISTS public.legacy_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                       -- faction / formulaire d'origine
  submitted_at timestamptz,                   -- date de la candidature (peut être nulle)
  discord_name text,
  ig_name text,
  age integer,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,      -- toutes les réponses originales (question -> réponse)
  contact_status text NOT NULL DEFAULT 'to_contact'
    CHECK (contact_status IN ('to_contact', 'contacted', 'do_not_contact')),
  contact_note text,
  contact_updated_at timestamptz,
  contact_updated_by_discord_id text,
  contact_updated_by_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_apps_status ON public.legacy_applications(contact_status);
CREATE INDEX IF NOT EXISTS idx_legacy_apps_ig ON public.legacy_applications(lower(ig_name));
CREATE INDEX IF NOT EXISTS idx_legacy_apps_source ON public.legacy_applications(source);
CREATE INDEX IF NOT EXISTS idx_legacy_apps_submitted ON public.legacy_applications(submitted_at DESC NULLS LAST);

GRANT ALL ON public.legacy_applications TO service_role;
ALTER TABLE public.legacy_applications ENABLE ROW LEVEL SECURITY;
-- Aucune policy : tout passe par les server functions (clé service), gatées admin.access.
