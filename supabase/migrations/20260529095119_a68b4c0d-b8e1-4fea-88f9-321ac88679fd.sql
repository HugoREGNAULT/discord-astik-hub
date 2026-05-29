-- Admin shop price history (one snapshot per day per item)
CREATE TABLE public.paladium_admin_shop_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name text NOT NULL,
  category text,
  price numeric,
  price_pb numeric,
  raw jsonb,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (item_name, snapshot_date)
);
CREATE INDEX idx_admin_shop_history_item ON public.paladium_admin_shop_history (item_name, snapshot_date DESC);

GRANT SELECT ON public.paladium_admin_shop_history TO authenticated;
GRANT ALL ON public.paladium_admin_shop_history TO service_role;
ALTER TABLE public.paladium_admin_shop_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin shop history readable by authenticated"
  ON public.paladium_admin_shop_history FOR SELECT TO authenticated USING (true);

-- Server status history (every 15 min)
CREATE TABLE public.paladium_server_status_history (
  id bigserial PRIMARY KEY,
  server_key text NOT NULL,          -- 'java.global', 'launcher', 'anarchy', 'java.factions.<name>'
  server_label text,
  online_players integer,
  max_players integer,
  is_online boolean NOT NULL DEFAULT false,
  raw jsonb,
  captured_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_key_time ON public.paladium_server_status_history (server_key, captured_at DESC);
CREATE INDEX idx_status_history_time ON public.paladium_server_status_history (captured_at DESC);

GRANT SELECT ON public.paladium_server_status_history TO authenticated;
GRANT ALL ON public.paladium_server_status_history TO service_role;
ALTER TABLE public.paladium_server_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status history readable by authenticated"
  ON public.paladium_server_status_history FOR SELECT TO authenticated USING (true);