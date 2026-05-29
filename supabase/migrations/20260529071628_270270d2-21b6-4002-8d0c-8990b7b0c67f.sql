-- 1. Remove authenticated write policies on value-icons (only service_role should mutate)
DROP POLICY IF EXISTS "Authenticated can upload value icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update value icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete value icons" ON storage.objects;

-- 2. Remove the broad SELECT policy that allowed listing all files in the bucket.
--    The bucket stays public, so direct public URLs (/object/public/...) keep working.
DROP POLICY IF EXISTS "Value icons are publicly readable" ON storage.objects;

-- 3. Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated.
--    sync_member_points_from_ledger is only invoked by its trigger; triggers don't need EXECUTE grants.
--    capture_leaderboard_snapshot is invoked from trusted server code via the service role.
REVOKE EXECUTE ON FUNCTION public.sync_member_points_from_ledger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_leaderboard_snapshot() FROM PUBLIC, anon, authenticated;