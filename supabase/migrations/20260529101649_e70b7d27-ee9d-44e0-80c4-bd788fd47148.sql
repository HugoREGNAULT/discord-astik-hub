CREATE TABLE public.paladium_market_price_history (
  id BIGSERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  price_average NUMERIC,
  count_listings INTEGER,
  quantity_available INTEGER,
  quantity_sold_total BIGINT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.paladium_market_price_history TO authenticated;
GRANT ALL ON public.paladium_market_price_history TO service_role;

ALTER TABLE public.paladium_market_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market price history readable by authenticated"
ON public.paladium_market_price_history
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_market_price_history_item_time
  ON public.paladium_market_price_history (item_name, captured_at DESC);

CREATE INDEX idx_market_price_history_time
  ON public.paladium_market_price_history (captured_at DESC);