
-- Défense en profondeur : révoque tous les droits anon/authenticated sur le schéma public.
-- Tout le backend passe par le service_role (admin client), donc rien ne casse.
-- Les futures tables n'auront pas de droits par défaut non plus.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Activer pg_cron / pg_net pour le job d'expiration des paniers
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supprimer un éventuel job précédent puis (re)programmer
DO $$
BEGIN
  PERFORM cron.unschedule('expire-donations-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'expire-donations-hourly',
  '*/10 * * * *', -- toutes les 10 minutes
  $$
  UPDATE public.donations
     SET status = 'expired', updated_at = now()
   WHERE status = 'active'
     AND expires_at < now();
  $$
);
