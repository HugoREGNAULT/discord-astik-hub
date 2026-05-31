
-- =========================================================
-- member_xp
-- =========================================================
CREATE TABLE IF NOT EXISTS public.member_xp (
  discord_id text PRIMARY KEY,
  xp bigint NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  current_streak_days int NOT NULL DEFAULT 0,
  longest_streak_days int NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_xp TO authenticated;
GRANT ALL ON public.member_xp TO service_role;
ALTER TABLE public.member_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_xp readable by authenticated"
  ON public.member_xp FOR SELECT TO authenticated USING (true);

-- =========================================================
-- seasons
-- =========================================================
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons readable by authenticated"
  ON public.seasons FOR SELECT TO authenticated USING (true);

-- =========================================================
-- badges: add criteria column (existing table preserved)
-- =========================================================
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS criteria jsonb;

-- Unique award per (member, badge)
CREATE UNIQUE INDEX IF NOT EXISTS member_badges_unique_pair
  ON public.member_badges (member_discord_id, badge_id);

-- =========================================================
-- level_for_xp(xp) -> int
-- Quadratic curve: each level n needs n*100 cumulative XP^2 base.
-- xp 0..99 -> lvl 1; xp 100..399 -> lvl 2; xp 400..899 -> lvl 3 ; etc.
-- Formula: level = floor(sqrt(xp / 100)) + 1
-- =========================================================
CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp bigint)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, FLOOR(SQRT(GREATEST(p_xp,0)::numeric / 100))::int + 1);
$$;

-- =========================================================
-- recompute_member_xp(): idempotent, daily-cap on points farming
-- Coefficients (tweak here):
--   W_MSG       = 1          xp / message
--   W_VOICE_MIN = 0.2        xp / minute voice
--   W_POINTS    = 2          xp / positive ledger point
--   W_DONATION  = 50         xp / validated donation
--   DAILY_POINTS_CAP = 500   max positive points counted per day
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_member_xp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  W_MSG          numeric := 1;
  W_VOICE_MIN    numeric := 0.2;
  W_POINTS       numeric := 2;
  W_DONATION     numeric := 50;
  DAILY_CAP      int     := 500;
  r              record;
  v_pts          numeric;
  v_dons         int;
  v_xp           bigint;
  v_today        date := (now() AT TIME ZONE 'UTC')::date;
  v_active_today boolean;
  v_prev         record;
  v_streak       int;
  v_longest      int;
BEGIN
  FOR r IN
    SELECT m.discord_id, m.messages_total, m.voice_total_seconds
    FROM public.members m
    WHERE m.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.anomaly_flags f
        WHERE f.member_discord_id = m.discord_id AND f.status = 'open'
      )
  LOOP
    -- Sum positive points, capped per day
    SELECT COALESCE(SUM(LEAST(day_sum, DAILY_CAP)), 0) INTO v_pts
    FROM (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS d, SUM(amount) AS day_sum
      FROM public.points_ledger
      WHERE member_discord_id = r.discord_id AND amount > 0
      GROUP BY 1
    ) s;

    SELECT COUNT(*) INTO v_dons
    FROM public.donations
    WHERE member_discord_id = r.discord_id AND status = 'validated';

    v_xp := FLOOR(
      r.messages_total * W_MSG
      + (r.voice_total_seconds::numeric / 60) * W_VOICE_MIN
      + v_pts * W_POINTS
      + v_dons * W_DONATION
    )::bigint;

    -- Activity today?
    SELECT EXISTS(
      SELECT 1 FROM public.points_ledger
      WHERE member_discord_id = r.discord_id
        AND created_at >= v_today
    ) INTO v_active_today;

    SELECT current_streak_days, longest_streak_days, last_active_date
    INTO v_prev
    FROM public.member_xp WHERE discord_id = r.discord_id;

    v_streak := COALESCE(v_prev.current_streak_days, 0);
    v_longest := COALESCE(v_prev.longest_streak_days, 0);

    IF v_active_today THEN
      IF v_prev.last_active_date = v_today THEN
        -- already counted today
        NULL;
      ELSIF v_prev.last_active_date = v_today - 1 THEN
        v_streak := v_streak + 1;
      ELSE
        v_streak := 1;
      END IF;
      IF v_streak > v_longest THEN v_longest := v_streak; END IF;
    ELSE
      IF v_prev.last_active_date IS NOT NULL AND v_prev.last_active_date < v_today - 1 THEN
        v_streak := 0;
      END IF;
    END IF;

    INSERT INTO public.member_xp (discord_id, xp, level, current_streak_days, longest_streak_days, last_active_date, updated_at)
    VALUES (
      r.discord_id, v_xp, public.level_for_xp(v_xp),
      v_streak, v_longest,
      CASE WHEN v_active_today THEN v_today ELSE v_prev.last_active_date END,
      now()
    )
    ON CONFLICT (discord_id) DO UPDATE
      SET xp = EXCLUDED.xp,
          level = EXCLUDED.level,
          current_streak_days = EXCLUDED.current_streak_days,
          longest_streak_days = EXCLUDED.longest_streak_days,
          last_active_date = EXCLUDED.last_active_date,
          updated_at = now();
  END LOOP;

  -- =====================================================
  -- Auto-award badges based on criteria jsonb
  -- Supported: {"type":"points_total","gte":N}
  --            {"type":"streak","gte":N}
  --            {"type":"first_donation"}
  --            {"type":"messages_total","gte":N}
  --            {"type":"xp","gte":N}
  -- =====================================================
  INSERT INTO public.member_badges (member_discord_id, badge_id, awarded_at)
  SELECT m.discord_id, b.id, now()
  FROM public.badges b
  CROSS JOIN public.members m
  LEFT JOIN public.member_xp x ON x.discord_id = m.discord_id
  WHERE m.status = 'active' AND b.criteria IS NOT NULL
    AND (
      (b.criteria->>'type' = 'points_total'
         AND m.astik_points >= (b.criteria->>'gte')::int)
      OR (b.criteria->>'type' = 'xp'
         AND COALESCE(x.xp,0) >= (b.criteria->>'gte')::bigint)
      OR (b.criteria->>'type' = 'messages_total'
         AND m.messages_total >= (b.criteria->>'gte')::int)
      OR (b.criteria->>'type' = 'streak'
         AND COALESCE(x.current_streak_days,0) >= (b.criteria->>'gte')::int)
      OR (b.criteria->>'type' = 'first_donation'
         AND EXISTS (SELECT 1 FROM public.donations d
                     WHERE d.member_discord_id = m.discord_id AND d.status = 'validated'))
    )
  ON CONFLICT (member_discord_id, badge_id) DO NOTHING;
END;
$$;
