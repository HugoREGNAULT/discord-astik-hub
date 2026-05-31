-- Realtime pour applications / donations / warnings.
-- IMPORTANT (sécurité) : le projet a REVOKE ALL FROM authenticated par défaut, donc
-- Supabase Realtime (qui passe par PostgREST + RLS) ne pousse rien sans GRANT + policy.
-- La policy ci-dessous autorise volontairement une LECTURE LARGE (USING (true)) pour
-- que le canal Realtime puisse émettre des notifications de changement à TOUT membre
-- authentifié. C'est intentionnel : le client n'utilise ces pushes QUE pour invalider
-- son cache TanStack Query. Le DÉTAIL sensible (ledger, motifs, identités complètes)
-- reste servi par les server functions gatées via requirePermission(). Aucun secret
-- métier ne fuit via ces notifications postgres_changes (seules les colonnes mises à
-- jour transitent, et leur lecture est déjà filtrée applicativement).

-- REPLICA IDENTITY FULL : nécessaire pour que Realtime émette l'ancienne ligne sur UPDATE/DELETE.
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.donations REPLICA IDENTITY FULL;
ALTER TABLE public.warnings REPLICA IDENTITY FULL;

-- Ajout à la publication realtime (idempotent : on ignore si déjà présent).
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.warnings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- GRANT SELECT minimum pour que Realtime puisse lire au nom du rôle authenticated.
-- (Les GRANT service_role existants ne sont PAS touchés.)
GRANT SELECT ON public.applications TO authenticated;
GRANT SELECT ON public.donations TO authenticated;
GRANT SELECT ON public.warnings TO authenticated;

-- Active RLS et ajoute UNE policy de lecture Realtime par table.
-- Lecture volontairement large — voir le bloc commentaire en tête de migration.
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_realtime_authenticated" ON public.applications;
CREATE POLICY "applications_realtime_authenticated"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "donations_realtime_authenticated" ON public.donations;
CREATE POLICY "donations_realtime_authenticated"
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "warnings_realtime_authenticated" ON public.warnings;
CREATE POLICY "warnings_realtime_authenticated"
  ON public.warnings
  FOR SELECT
  TO authenticated
  USING (true);