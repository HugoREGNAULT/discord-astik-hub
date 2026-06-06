-- Personnalisation du profil membre (/me) : bio courte + tags de rôle.
-- bio  : présentation libre, longueur bornée côté serveur (~280 caractères).
-- roles: tags de spécialité (pvp / builder / farmer / staff / ...), liste blanche côté serveur.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';
