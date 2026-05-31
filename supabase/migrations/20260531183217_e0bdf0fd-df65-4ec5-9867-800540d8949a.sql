CREATE OR REPLACE FUNCTION public.apply_points_delta(p_discord_id text, p_delta int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
BEGIN
  UPDATE public.members
  SET astik_points = GREATEST(0, astik_points + p_delta)
  WHERE discord_id = p_discord_id
  RETURNING astik_points INTO v_new;
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_member_points(p_discord_id text, p_total int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
BEGIN
  UPDATE public.members
  SET astik_points = p_total
  WHERE discord_id = p_discord_id
  RETURNING astik_points INTO v_new;
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_messages_total(p_discord_id text, p_inc int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
BEGIN
  UPDATE public.members
  SET messages_total = messages_total + p_inc
  WHERE discord_id = p_discord_id
  RETURNING messages_total INTO v_new;
  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_points_delta(text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_member_points(text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_messages_total(text, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_points_delta(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_member_points(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_messages_total(text, int) TO service_role;