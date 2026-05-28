-- 1) Empêcher le double-vote dans poll_votes
-- Nettoyer d'abord les éventuels doublons existants (garde le plus récent)
DELETE FROM public.poll_votes a
USING public.poll_votes b
WHERE a.option_id = b.option_id
  AND a.voter_discord_id = b.voter_discord_id
  AND a.created_at < b.created_at;

ALTER TABLE public.poll_votes
  ADD CONSTRAINT poll_votes_option_voter_unique
  UNIQUE (option_id, voter_discord_id);

-- 2) Table blacklist
CREATE TABLE public.blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id text,
  mc_name text,
  mc_uuid text,
  reason text NOT NULL DEFAULT '',
  added_by_discord_id text NOT NULL,
  added_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blacklist_at_least_one_identifier CHECK (
    discord_id IS NOT NULL OR mc_name IS NOT NULL OR mc_uuid IS NOT NULL
  )
);

CREATE INDEX blacklist_discord_id_idx ON public.blacklist (discord_id);
CREATE INDEX blacklist_mc_name_lower_idx ON public.blacklist (lower(mc_name));
CREATE INDEX blacklist_mc_uuid_idx ON public.blacklist (mc_uuid);

-- Grants (service_role uniquement, comme les autres tables sécurisées)
GRANT ALL ON public.blacklist TO service_role;
REVOKE ALL ON public.blacklist FROM anon, authenticated;

-- Activer RLS sans aucune policy : accès via clé publique impossible,
-- service_role bypass RLS donc les serverFn fonctionnent.
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER blacklist_touch_updated_at
BEFORE UPDATE ON public.blacklist
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();