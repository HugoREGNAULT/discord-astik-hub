CREATE INDEX IF NOT EXISTS idx_donations_staff_status
  ON public.donations (staff_discord_id, status);

CREATE INDEX IF NOT EXISTS idx_points_ledger_staff_created
  ON public.points_ledger (staff_discord_id, created_at DESC);