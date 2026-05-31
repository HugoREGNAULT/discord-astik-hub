-- Historique des valeurs de points (pour calcul d'évolution %)
CREATE TABLE public.config_values_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_id uuid NOT NULL REFERENCES public.config_values(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  points numeric NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_discord_id text
);

CREATE INDEX idx_cvh_value_changed ON public.config_values_history(value_id, changed_at DESC);
CREATE INDEX idx_cvh_changed_at ON public.config_values_history(changed_at DESC);

GRANT SELECT ON public.config_values_history TO authenticated;
GRANT ALL ON public.config_values_history TO service_role;

ALTER TABLE public.config_values_history ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée à tout utilisateur connecté (la couche serveur applique requireSession)
CREATE POLICY "history readable by authenticated"
ON public.config_values_history
FOR SELECT
TO authenticated
USING (true);

-- Trigger : snapshot à chaque INSERT ou UPDATE de points
CREATE OR REPLACE FUNCTION public.snapshot_config_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.points IS DISTINCT FROM OLD.points) THEN
    INSERT INTO public.config_values_history (value_id, category, name, points)
    VALUES (NEW.id, NEW.category, NEW.name, NEW.points);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_config_value
AFTER INSERT OR UPDATE OF points ON public.config_values
FOR EACH ROW EXECUTE FUNCTION public.snapshot_config_value();

-- Seed : capture l'état actuel comme baseline
INSERT INTO public.config_values_history (value_id, category, name, points)
SELECT id, category, name, points FROM public.config_values;
