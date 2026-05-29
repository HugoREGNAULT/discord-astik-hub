-- Auto-sync astik_points from ledger
CREATE OR REPLACE FUNCTION public.sync_member_points_from_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members
  SET astik_points = NEW.total_after,
      updated_at = now()
  WHERE discord_id = NEW.member_discord_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_points ON public.points_ledger;
CREATE TRIGGER trg_sync_member_points
AFTER INSERT ON public.points_ledger
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_points_from_ledger();

-- updated_at touch for members
DROP TRIGGER IF EXISTS trg_members_touch ON public.members;
CREATE TRIGGER trg_members_touch
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Helpful index for bot upserts
CREATE UNIQUE INDEX IF NOT EXISTS members_discord_id_uniq ON public.members(discord_id);