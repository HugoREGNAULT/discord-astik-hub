-- Palette de blocs partagée
CREATE TABLE public.pdc_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  kind text NOT NULL DEFAULT 'block',
  created_by_discord_id text,
  created_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdc_blocks_kind_check CHECK (kind IN ('block','liquid')),
  CONSTRAINT pdc_blocks_name_unique UNIQUE (name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdc_blocks TO authenticated;
GRANT ALL ON public.pdc_blocks TO service_role;
ALTER TABLE public.pdc_blocks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER pdc_blocks_touch
BEFORE UPDATE ON public.pdc_blocks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Plans de coupe sauvegardés
CREATE TABLE public.pdc_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  width_chunks integer NOT NULL DEFAULT 11,
  height_chunks integer NOT NULL DEFAULT 11,
  layers_count integer NOT NULL DEFAULT 1,
  -- layers: { "0": { "x,y": block_id_uuid, ... }, "1": {...} }
  layers jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by_discord_id text NOT NULL,
  created_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdc_plans_size_check CHECK (width_chunks BETWEEN 1 AND 50 AND height_chunks BETWEEN 1 AND 50),
  CONSTRAINT pdc_plans_layers_check CHECK (layers_count BETWEEN 1 AND 256)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdc_plans TO authenticated;
GRANT ALL ON public.pdc_plans TO service_role;
ALTER TABLE public.pdc_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pdc_plans_created_by ON public.pdc_plans (created_by_discord_id);
CREATE INDEX idx_pdc_plans_updated_at ON public.pdc_plans (updated_at DESC);

CREATE TRIGGER pdc_plans_touch
BEFORE UPDATE ON public.pdc_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Quelques blocs de base utiles sur Paladium
INSERT INTO public.pdc_blocks (name, color, kind) VALUES
  ('Big Obsidienne', '#1a0d2e', 'block'),
  ('Obsidienne', '#2d1b4e', 'block'),
  ('Sable', '#e8d99a', 'block'),
  ('Bedrock', '#3a3a3a', 'block'),
  ('Cobblestone', '#7a7a7a', 'block'),
  ('Terre', '#8b5a2b', 'block'),
  ('Pierre', '#9a9a9a', 'block'),
  ('Sulfuric Water', '#c4ff3d', 'liquid'),
  ('Eau', '#3b6fa0', 'liquid'),
  ('Lave', '#e85d3a', 'liquid');