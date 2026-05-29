-- Allow multiple admin shop snapshots per day (price evolution every 5 min)
ALTER TABLE public.paladium_admin_shop_history DROP CONSTRAINT IF EXISTS paladium_admin_shop_history_item_name_snapshot_date_key;
DROP INDEX IF EXISTS idx_admin_shop_history_item;
CREATE INDEX IF NOT EXISTS idx_admin_shop_history_item_time ON public.paladium_admin_shop_history (item_name, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_shop_history_time ON public.paladium_admin_shop_history (captured_at DESC);