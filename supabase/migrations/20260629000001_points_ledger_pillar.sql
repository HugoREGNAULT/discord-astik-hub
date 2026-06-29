-- Ajoute la colonne pilier sur points_ledger.
-- Nullable : les lignes historiques restent valides (pillar = NULL = non catégorisé).
ALTER TABLE public.points_ledger
  ADD COLUMN IF NOT EXISTS pillar TEXT
    CHECK (pillar IN ('discord_activity', 'ig_investment', 'global_investment'));

CREATE INDEX IF NOT EXISTS idx_points_ledger_pillar
  ON public.points_ledger(member_discord_id, pillar)
  WHERE pillar IS NOT NULL;
