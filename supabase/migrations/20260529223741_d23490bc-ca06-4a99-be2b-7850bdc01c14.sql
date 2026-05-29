CREATE TABLE public.shop_admin_price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_discord_id text NOT NULL,
  user_username text,
  item_name text NOT NULL,
  price_type text NOT NULL DEFAULT 'sell' CHECK (price_type IN ('buy','sell')),
  direction text NOT NULL CHECK (direction IN ('above','below')),
  threshold numeric NOT NULL,
  is_triggered boolean NOT NULL DEFAULT false,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_alerts_item ON public.shop_admin_price_alerts (item_name);
CREATE INDEX idx_shop_alerts_user ON public.shop_admin_price_alerts (user_discord_id);

GRANT SELECT ON public.shop_admin_price_alerts TO authenticated;
GRANT ALL ON public.shop_admin_price_alerts TO service_role;

ALTER TABLE public.shop_admin_price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts readable by authenticated"
ON public.shop_admin_price_alerts FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_shop_alerts_updated
BEFORE UPDATE ON public.shop_admin_price_alerts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();