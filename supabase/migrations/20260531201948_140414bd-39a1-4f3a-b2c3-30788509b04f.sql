CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  require_ack boolean NOT NULL DEFAULT true,
  created_by_discord_id text NOT NULL,
  created_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements readable by authenticated"
  ON public.announcements FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_announcements_pinned_created ON public.announcements(pinned DESC, created_at DESC);

CREATE TABLE public.announcement_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  member_discord_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, member_discord_id)
);

GRANT SELECT ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcement_reads readable by authenticated"
  ON public.announcement_reads FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_announcement_reads_member ON public.announcement_reads(member_discord_id);
CREATE INDEX idx_announcement_reads_announcement ON public.announcement_reads(announcement_id);