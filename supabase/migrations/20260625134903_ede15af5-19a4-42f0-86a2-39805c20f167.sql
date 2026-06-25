
-- 1) Remove permissive RLS on leaderboard snapshot rollup tables (fall back to deny-all)
DROP POLICY IF EXISTS "snapshots_2h readable by authenticated" ON public.leaderboard_snapshots_2h;
DROP POLICY IF EXISTS "snapshots_1d readable by authenticated" ON public.leaderboard_snapshots_1d;

-- 2) Set immutable search_path on the one function missing it
ALTER FUNCTION public.leaderboard_history(text) SET search_path = public;

-- 3) Revoke EXECUTE from anon/authenticated/PUBLIC on all SECURITY DEFINER functions
--    They are only invoked via service role (server functions / cron).
REVOKE EXECUTE ON FUNCTION public.apply_points_delta(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_leaderboard_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_carts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_messages_total(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.logs_hash_chain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_member_xp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_leaderboard_1d() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_leaderboard_2h() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_points(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_config_value() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_member_points_from_ledger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_logs_chain() FROM PUBLIC, anon, authenticated;
