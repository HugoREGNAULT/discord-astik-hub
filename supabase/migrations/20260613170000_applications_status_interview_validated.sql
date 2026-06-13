-- Autorise le statut 'interview_validated' sur public.applications.
--
-- validateInterview (src/lib/data/applications.functions.ts, etape 2 du
-- recrutement) passe la candidature en status='interview_validated' apres
-- l'entretien, puis cree la fiche membre en essai 14j et envoie le DM.
-- Or la contrainte applications_status_check (CREATE TABLE migration
-- 20260528132231) ne listait que ('pending','accepted','rejected') : l'UPDATE
-- 'interview_validated' etait rejete. Le DM et la fiche membre partaient quand
-- meme -> la candidature restait bloquee a 'accepted', l'essai 14j ne demarrait
-- jamais cote candidature (incoherence). Le code verifie desormais l'erreur.
--
-- A APPLIQUER EN PRODUCTION VIA LE SQL EDITOR (Lovable Cloud) AVANT le Publish :
-- le push GitHub n'execute pas automatiquement les migrations.
-- Idempotent (DROP IF EXISTS + ADD). Si l'ADD echoue sur un conflit de nom,
-- verifier le nom reel : SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.applications'::regclass AND contype = 'c';
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check,
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'interview_validated'));
