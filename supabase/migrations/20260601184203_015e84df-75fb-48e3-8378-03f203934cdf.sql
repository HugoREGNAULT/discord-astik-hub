-- Lock down SECURITY DEFINER functions: revoke from public/anon/authenticated.
-- All app calls go through service_role (server functions / cron), which retains access.
REVOKE EXECUTE ON FUNCTION public.apply_points_delta(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_points(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_messages_total(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_leaderboard_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_carts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_member_xp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_logs_chain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_config_value() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_member_points_from_ledger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.logs_hash_chain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Fix mutable search_path on level_for_xp (IMMUTABLE SQL function).
CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp bigint)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT GREATEST(1, FLOOR(SQRT(GREATEST(p_xp,0)::numeric / 100))::int + 1);
$function$;