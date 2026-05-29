CREATE TABLE public.minecraft_uuid_cache (
  uuid text PRIMARY KEY,
  username text NOT NULL,
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_minecraft_uuid_cache_username_lower ON public.minecraft_uuid_cache (username_lower);

GRANT SELECT ON public.minecraft_uuid_cache TO authenticated;
GRANT ALL ON public.minecraft_uuid_cache TO service_role;

ALTER TABLE public.minecraft_uuid_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uuid cache readable by authenticated"
ON public.minecraft_uuid_cache
FOR SELECT
TO authenticated
USING (true);