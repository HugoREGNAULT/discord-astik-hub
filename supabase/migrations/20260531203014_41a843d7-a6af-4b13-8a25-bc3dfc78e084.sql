CREATE OR REPLACE VIEW public.v_faction_member_sales AS
SELECT
  m.discord_id,
  COALESCE(m.ig_name, m.discord_username, m.discord_id) AS name,
  h.item_name,
  h.quantity,
  h.price,
  h.price_pb,
  h.first_seen_at,
  h.sold_at
FROM public.members m
JOIN public.paladium_player_listings_history h
  ON h.player_uuid = m.mc_uuid
WHERE m.status = 'active';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader') THEN
    EXECUTE 'GRANT SELECT ON public.v_faction_member_sales TO grafana_reader';
  END IF;
END$$;