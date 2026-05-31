-- Notifications: persisted user-facing inbox
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_discord_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx
  ON public.notifications (recipient_discord_id, read_at, created_at DESC);

GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- NOTE: filtrage par destinataire fait dans la server function gatée
-- (requireSession + where recipient = user.discordId). On laisse SELECT true
-- pour que Realtime push tout - le client n'utilise ce push QUE pour invalider
-- son cache; le contenu reste servi par la server function.
CREATE POLICY "notifications_realtime_authenticated"
  ON public.notifications FOR SELECT TO authenticated USING (true);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Préférences de notification par membre/kind
CREATE TABLE public.notification_prefs (
  discord_id text NOT NULL,
  kind text NOT NULL,
  web boolean NOT NULL DEFAULT true,
  discord_dm boolean NOT NULL DEFAULT false,
  web_push boolean NOT NULL DEFAULT false,
  PRIMARY KEY (discord_id, kind)
);
GRANT SELECT ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- Règles d'automation (moteur)
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger jsonb NOT NULL,
  action jsonb NOT NULL,
  mode text NOT NULL DEFAULT 'propose' CHECK (mode IN ('propose','execute')),
  enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;