CREATE OR REPLACE FUNCTION public.verify_logs_chain()
RETURNS TABLE (ok boolean, broken_at_seq bigint, scanned bigint, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_prev text := NULL;
  v_expected text;
  v_scanned bigint := 0;
BEGIN
  FOR r IN SELECT seq, action, actor_discord_id, payload, created_at, prev_hash, hash
           FROM public.logs
           ORDER BY seq ASC
  LOOP
    IF r.prev_hash IS DISTINCT FROM v_prev THEN
      RETURN QUERY SELECT false, r.seq, v_scanned, format('prev_hash mismatch at seq=%s', r.seq);
      RETURN;
    END IF;
    v_expected := encode(
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
    IF v_expected IS DISTINCT FROM r.hash THEN
      RETURN QUERY SELECT false, r.seq, v_scanned, format('hash mismatch at seq=%s', r.seq);
      RETURN;
    END IF;
    v_prev := r.hash;
    v_scanned := v_scanned + 1;
  END LOOP;
  RETURN QUERY SELECT true, NULL::bigint, v_scanned, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_logs_chain() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_logs_chain() TO authenticated, service_role;
