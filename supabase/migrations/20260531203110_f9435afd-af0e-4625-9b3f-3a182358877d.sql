CREATE TABLE public.anomaly_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('point_farm','alt_transfer','ratio_mismatch','new_farmer')),
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','med','high')),
  score numeric,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_explanation text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  reviewed_by_discord_id text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.anomaly_flags TO service_role;

ALTER TABLE public.anomaly_flags ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_anomaly_flags_status_sev_created
  ON public.anomaly_flags (status, severity, created_at DESC);

CREATE UNIQUE INDEX uniq_anomaly_flags_open_member_kind
  ON public.anomaly_flags (member_discord_id, kind)
  WHERE status = 'open';