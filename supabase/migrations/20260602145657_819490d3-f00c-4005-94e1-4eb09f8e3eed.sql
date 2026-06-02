
CREATE TABLE public.usage_events (
  id BIGSERIAL PRIMARY KEY,
  actor_discord_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_created_at_idx ON public.usage_events (created_at DESC);
CREATE INDEX usage_events_path_idx ON public.usage_events (path);
CREATE INDEX usage_events_actor_idx ON public.usage_events (actor_discord_id);

GRANT ALL ON public.usage_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.usage_events_id_seq TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
-- No policies: only server-side service-role reads/writes (via server functions).
