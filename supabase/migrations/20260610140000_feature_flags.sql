-- Feature flags génériques (clé/valeur booléenne) : permet au staff de publier
-- ou de masquer temporairement un module (ex : la page Réunion V12) sans déploiement.
-- À appliquer dans le SQL Editor Supabase AVANT le Publish Lovable.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_discord_id text
);

-- Accès uniquement via les server functions (service role, qui bypass RLS).
-- RLS activé sans policy => l'API anon/publique ne peut rien lire ni écrire.
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Drapeau de publication de la page Réunion V12 (masquée par défaut).
INSERT INTO public.feature_flags (key, enabled)
VALUES ('reunion_v12_published', false)
ON CONFLICT (key) DO NOTHING;
