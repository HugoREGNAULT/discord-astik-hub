ALTER TABLE public.config_values ALTER COLUMN points TYPE numeric(14,4) USING points::numeric;
ALTER TABLE public.config_values ALTER COLUMN points SET DEFAULT 0;