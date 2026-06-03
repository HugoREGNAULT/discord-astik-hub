-- Autorise le statut 'trial' sur public.members.
--
-- decideApplication (src/lib/data/applications.functions.ts) passe une fiche
-- membre en status='trial' lors de l'ACCEPTATION d'une candidature (periode
-- d'essai 14j), et trial.functions.ts la lit via .eq("status","trial").
-- Or la contrainte members_status_check (migration 20260531184656) ne listait
-- que ('active','former','away','left') : l'ecriture 'trial' etait rejetee, et
-- comme l'UPDATE/INSERT ne verifie pas l'erreur, l'echec passait silencieux ->
-- la fiche periode d'essai n'etait jamais enregistree.
--
-- Applique en production le 2026-06-03 via le SQL Editor (Lovable Cloud).
-- Idempotent (DROP IF EXISTS + ADD).
ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_status_check,
  ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'former', 'away', 'left', 'trial'));
