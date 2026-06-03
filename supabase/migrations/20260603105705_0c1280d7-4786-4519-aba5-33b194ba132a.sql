-- 1) Drop authenticated SELECT policies on public tables
DROP POLICY IF EXISTS "ai_digests readable by authenticated" ON public.ai_digests;
DROP POLICY IF EXISTS "announcement_reads readable by authenticated" ON public.announcement_reads;
DROP POLICY IF EXISTS "announcements readable by authenticated" ON public.announcements;
DROP POLICY IF EXISTS "applications_realtime_authenticated" ON public.applications;
DROP POLICY IF EXISTS "audit_integrity_checks readable by authenticated" ON public.audit_integrity_checks;
DROP POLICY IF EXISTS "badges readable by authenticated" ON public.badges;
DROP POLICY IF EXISTS "history readable by authenticated" ON public.config_values_history;
DROP POLICY IF EXISTS "donations_realtime_authenticated" ON public.donations;
DROP POLICY IF EXISTS "event_loot readable by authenticated" ON public.event_loot;
DROP POLICY IF EXISTS "event_signups readable by authenticated" ON public.event_signups;
DROP POLICY IF EXISTS "events readable by authenticated" ON public.events;
DROP POLICY IF EXISTS "bc checks readable by authenticated" ON public.faction_bc_checks;
DROP POLICY IF EXISTS "grade_thresholds readable by authenticated" ON public.grade_thresholds;
DROP POLICY IF EXISTS "inactivity_pings readable by authenticated" ON public.inactivity_pings;
DROP POLICY IF EXISTS "snapshots readable by all authenticated" ON public.leaderboard_snapshots;
DROP POLICY IF EXISTS "material_requests readable by authenticated" ON public.material_requests;
DROP POLICY IF EXISTS "mc_jobs_snapshots readable by authenticated" ON public.mc_jobs_snapshots;
DROP POLICY IF EXISTS "mc_player_stats readable by authenticated" ON public.mc_player_stats;
DROP POLICY IF EXISTS "member_badges readable by authenticated" ON public.member_badges;
DROP POLICY IF EXISTS "member_xp readable by authenticated" ON public.member_xp;
DROP POLICY IF EXISTS "uuid cache readable by authenticated" ON public.minecraft_uuid_cache;
DROP POLICY IF EXISTS "notifications_realtime_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "objective_contributions readable by authenticated" ON public.objective_contributions;
DROP POLICY IF EXISTS "onboarding_tasks readable by authenticated" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "admin shop history readable by authenticated" ON public.paladium_admin_shop_history;
DROP POLICY IF EXISTS "market price history readable by authenticated" ON public.paladium_market_price_history;
DROP POLICY IF EXISTS "listings history readable by authenticated" ON public.paladium_player_listings_history;
DROP POLICY IF EXISTS "status history readable by authenticated" ON public.paladium_server_status_history;
DROP POLICY IF EXISTS "tracked players readable by authenticated" ON public.paladium_tracked_players;
DROP POLICY IF EXISTS "project_contributions readable by authenticated" ON public.project_contributions;
DROP POLICY IF EXISTS "project_resources readable by authenticated" ON public.project_resources;
DROP POLICY IF EXISTS "projects readable by authenticated" ON public.projects;
DROP POLICY IF EXISTS "salary_grades readable by authenticated" ON public.salary_grades;
DROP POLICY IF EXISTS "salary_runs readable by authenticated" ON public.salary_runs;
DROP POLICY IF EXISTS "seasons readable by authenticated" ON public.seasons;
DROP POLICY IF EXISTS "alerts readable by authenticated" ON public.shop_admin_price_alerts;
DROP POLICY IF EXISTS "shop_rewards readable by authenticated" ON public.shop_rewards;
DROP POLICY IF EXISTS "staff_tasks readable by authenticated" ON public.staff_tasks;
DROP POLICY IF EXISTS "stock_items readable by authenticated" ON public.stock_items;
DROP POLICY IF EXISTS "storage_chests readable by authenticated" ON public.storage_chests;
DROP POLICY IF EXISTS "treasury_accounts readable by authenticated" ON public.treasury_accounts;
DROP POLICY IF EXISTS "trial_votes readable by authenticated" ON public.trial_votes;
DROP POLICY IF EXISTS "warnings_realtime_authenticated" ON public.warnings;

-- 2) Drop write policies on storage.objects for value-icons (authenticated)
DROP POLICY IF EXISTS "value-icons authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "value-icons authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "value-icons authenticated delete" ON storage.objects;

-- 3) Revoke residual public-schema table grants from anon/authenticated.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

-- 4) Realtime: deny-all on realtime.messages for anon/authenticated.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny realtime to anon" ON realtime.messages;
DROP POLICY IF EXISTS "deny realtime to authenticated" ON realtime.messages;

CREATE POLICY "deny realtime to anon"
  ON realtime.messages
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny realtime to authenticated"
  ON realtime.messages
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);