-- =========================
-- shop_rewards
-- =========================
CREATE TABLE public.shop_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cost_points integer NOT NULL CHECK (cost_points > 0),
  category text,
  stock integer,
  per_member_limit integer,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_rewards TO authenticated;
GRANT ALL ON public.shop_rewards TO service_role;

ALTER TABLE public.shop_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_rewards readable by authenticated"
  ON public.shop_rewards FOR SELECT
  TO authenticated USING (true);

-- =========================
-- spend_requests
-- =========================
CREATE TABLE public.spend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  reward_id uuid REFERENCES public.shop_rewards(id) ON DELETE SET NULL,
  reward_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost integer NOT NULL CHECK (unit_cost >= 0),
  total_cost integer NOT NULL CHECK (total_cost >= 0),
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  decided_by_discord_id text,
  decided_by_username text,
  decided_at timestamptz,
  fulfilled_at timestamptz,
  reject_reason text,
  ledger_id uuid
);

GRANT SELECT ON public.spend_requests TO authenticated;
GRANT ALL ON public.spend_requests TO service_role;

ALTER TABLE public.spend_requests ENABLE ROW LEVEL SECURITY;
-- Aucune policy SELECT large : les server functions lisent en service_role
-- avec filtrage (owner ou staff). Sans policy, authenticated ne lit rien.

CREATE INDEX idx_spend_requests_member_status
  ON public.spend_requests (member_discord_id, status);
CREATE INDEX idx_spend_requests_status_expires
  ON public.spend_requests (status, expires_at);

-- =========================
-- treasury_accounts
-- =========================
CREATE TABLE public.treasury_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'PB',
  balance numeric(16,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.treasury_accounts TO authenticated;
GRANT ALL ON public.treasury_accounts TO service_role;

ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treasury_accounts readable by authenticated"
  ON public.treasury_accounts FOR SELECT
  TO authenticated USING (true);

-- =========================
-- treasury_movements
-- =========================
CREATE TABLE public.treasury_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE CASCADE,
  delta numeric(16,2) NOT NULL,
  balance_after numeric(16,2) NOT NULL,
  reason text,
  source text,
  source_id uuid,
  staff_discord_id text,
  staff_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.treasury_movements TO authenticated;
GRANT ALL ON public.treasury_movements TO service_role;

ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;
-- Pas de policy SELECT publique : lecture restreinte via server functions
-- (shop.manage). authenticated ne lit pas directement.

CREATE INDEX idx_treasury_movements_account_created
  ON public.treasury_movements (account_id, created_at DESC);

-- =========================
-- Seed catalogue (4 récompenses d'exemple)
-- =========================
INSERT INTO public.shop_rewards (name, description, cost_points, category, stock, per_member_limit, display_order)
VALUES
  ('Kit Starter PvP', 'Set d''armure diamant + épée nethérite + nourriture pour 1 vie.', 500, 'kit', NULL, NULL, 10),
  ('Slot privé Faction', 'Un slot privé dans la base pour 7 jours.', 1500, 'service', 10, 1, 20),
  ('Spawner Zombie', 'Un spawner zombie livré dans ta base.', 3000, 'item', 5, 2, 30),
  ('Tag personnalisé Discord', 'Un tag custom devant ton pseudo Discord pendant 1 mois.', 800, 'cosmetique', NULL, 1, 40);
