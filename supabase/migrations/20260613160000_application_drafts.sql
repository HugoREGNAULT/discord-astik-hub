-- Brouillons de candidature : sauvegarde SERVEUR des candidatures en cours
-- (même non soumises) + signaux d'authenticité (collages / dynamique de frappe)
-- pour aider les recruteurs à repérer un texte copié-collé ou généré par IA.
-- Un brouillon par candidat (clé = discord_id), écrasé à chaque sauvegarde auto.
-- À appliquer dans le SQL Editor Supabase AVANT le Publish Lovable.

CREATE TABLE IF NOT EXISTS public.application_drafts (
  discord_id text PRIMARY KEY,
  discord_username text,
  mc_name text,
  heard_from text,
  presentation text,
  presentation_gaming text,
  age integer,
  country text,
  schedule text,
  objectives text,
  pvp_level integer,
  motivation text,
  additional_info text,
  form_rating numeric,
  -- Signaux d'authenticité (anti copier-coller / IA)
  paste_count integer NOT NULL DEFAULT 0,        -- nombre d'événements "coller"
  paste_total_chars integer NOT NULL DEFAULT 0,  -- total de caractères collés
  paste_events jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{len, t}] détail des collages
  keystroke_count integer NOT NULL DEFAULT 0,    -- touches "caractère" frappées
  char_count integer NOT NULL DEFAULT 0,         -- caractères actuellement saisis
  typing_ms integer NOT NULL DEFAULT 0,          -- temps de frappe actif (ms)
  submitted boolean NOT NULL DEFAULT false,      -- true une fois la candidature soumise
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Accès uniquement via les server functions (service role, qui bypass RLS).
-- RLS activé sans policy => l'API anon/publique ne peut rien lire ni écrire.
ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;

-- Liste "candidatures en cours" : brouillons non soumis, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS application_drafts_active_idx
  ON public.application_drafts (submitted, updated_at DESC);
