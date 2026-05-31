-- Hash-chained audit logs + integrity check table.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Columns on logs
ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS seq bigserial,
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS hash text;

CREATE INDEX IF NOT EXISTS idx_logs_seq ON public.logs (seq);

-- 2. Trigger that hash-chains every insert.
--    HONEST CAVEAT: anyone with service_role can also UPDATE/DELETE rows and
--    recompute the chain end-to-end. This mechanism DETECTS uncoordinated
--    tampering (a row edited or removed by accident, by a leak, or by a tool
--    that doesn't know about the chain) but is NOT cryptographically tamper-
--    proof against an attacker holding service_role.
CREATE OR REPLACE FUNCTION public.logs_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
BEGIN
  -- Serialize concurrent inserts so the chain stays linear.
  PERFORM pg_advisory_xact_lock(727274001);

  SELECT hash INTO v_prev
  FROM public.logs
  ORDER BY seq DESC
  LIMIT 1;

  NEW.prev_hash := v_prev;
  NEW.hash := encode(
    digest(
      coalesce(v_prev, '')
        || NEW.action
        || coalesce(NEW.actor_discord_id, '')
        || coalesce(NEW.payload::text, '')
        || NEW.created_at::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS logs_hash_chain_trg ON public.logs;
CREATE TRIGGER logs_hash_chain_trg
BEFORE INSERT ON public.logs
FOR EACH ROW EXECUTE FUNCTION public.logs_hash_chain();

-- 3. Backfill existing rows so verification has a continuous chain.
DO $$
DECLARE
  r record;
  v_prev text := NULL;
  v_hash text;
BEGIN
  FOR r IN SELECT id, action, actor_discord_id, payload, created_at
           FROM public.logs
           WHERE hash IS NULL
           ORDER BY seq ASC
  LOOP
    v_hash := encode(
      digest(
        coalesce(v_prev, '')
          || r.action
          || coalesce(r.actor_discord_id, '')
          || coalesce(r.payload::text, '')
          || r.created_at::text,
        'sha256'
      ),
      'hex'
    );
    UPDATE public.logs
       SET prev_hash = v_prev, hash = v_hash
     WHERE id = r.id;
    v_prev := v_hash;
  END LOOP;
END;
$$;

-- 4. Integrity check results table.
CREATE TABLE IF NOT EXISTS public.audit_integrity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  broken_at_seq bigint,
  detail text
);

GRANT SELECT ON public.audit_integrity_checks TO authenticated;
GRANT ALL    ON public.audit_integrity_checks TO service_role;

ALTER TABLE public.audit_integrity_checks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the latest check status from the admin page.
-- Writes happen via service_role inside the verify hook.
CREATE POLICY "audit_integrity_checks readable by authenticated"
ON public.audit_integrity_checks
FOR SELECT
TO authenticated
USING (true);
