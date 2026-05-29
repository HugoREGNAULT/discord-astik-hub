ALTER TABLE public.shop_admin_price_alerts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'shop_admin';

ALTER TABLE public.shop_admin_price_alerts
  DROP CONSTRAINT IF EXISTS shop_admin_price_alerts_source_check;
ALTER TABLE public.shop_admin_price_alerts
  ADD CONSTRAINT shop_admin_price_alerts_source_check
  CHECK (source IN ('shop_admin', 'market'));

CREATE INDEX IF NOT EXISTS shop_admin_price_alerts_source_item_idx
  ON public.shop_admin_price_alerts (source, item_name);

CREATE INDEX IF NOT EXISTS shop_admin_price_alerts_user_idx
  ON public.shop_admin_price_alerts (user_discord_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_admin_price_alerts TO authenticated;
GRANT ALL ON public.shop_admin_price_alerts TO service_role;