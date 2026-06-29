-- Table des motifs prédéfinis staff.
-- Aucune FK sur points_ledger : le motif est une UI-helper qui pré-remplit
-- reason et pillar dans le formulaire d'attribution.
CREATE TABLE public.point_reasons (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT        NOT NULL,
  pillar     TEXT        NOT NULL
               CHECK (pillar IN ('discord_activity','ig_investment','global_investment')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_reasons_active ON public.point_reasons(active, label);
GRANT ALL ON public.point_reasons TO service_role;
ALTER TABLE public.point_reasons ENABLE ROW LEVEL SECURITY;

-- Seed : motifs de départ
INSERT INTO public.point_reasons (label, pillar) VALUES
  ('Don BDF',           'ig_investment'),
  ('Aide T4',           'global_investment'),
  ('Farm collectif',    'global_investment'),
  ('Activité Discord',  'discord_activity'),
  ('Aide build',        'global_investment');
