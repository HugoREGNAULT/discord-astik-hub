
CREATE TABLE public.paladium_tracked_players (
  uuid text PRIMARY KEY,
  username text NOT NULL,
  search_count integer NOT NULL DEFAULT 0,
  first_searched_at timestamptz NOT NULL DEFAULT now(),
  last_searched_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);
GRANT SELECT ON public.paladium_tracked_players TO authenticated;
GRANT ALL ON public.paladium_tracked_players TO service_role;
ALTER TABLE public.paladium_tracked_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracked players readable by authenticated"
  ON public.paladium_tracked_players FOR SELECT TO authenticated USING (true);

CREATE TABLE public.paladium_player_listings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_uuid text NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL,
  price numeric NOT NULL,
  price_pb numeric,
  listed_at timestamptz,
  expires_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  external_id text
);
CREATE INDEX idx_pllh_player ON public.paladium_player_listings_history(player_uuid, sold_at);
CREATE UNIQUE INDEX idx_pllh_dedup ON public.paladium_player_listings_history(player_uuid, item_name, price, quantity, COALESCE(listed_at, first_seen_at));
GRANT SELECT ON public.paladium_player_listings_history TO authenticated;
GRANT ALL ON public.paladium_player_listings_history TO service_role;
ALTER TABLE public.paladium_player_listings_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings history readable by authenticated"
  ON public.paladium_player_listings_history FOR SELECT TO authenticated USING (true);
