
CREATE TABLE public.storage_chests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  description text,
  created_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.storage_chests TO authenticated;
GRANT ALL ON public.storage_chests TO service_role;
ALTER TABLE public.storage_chests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storage_chests readable by authenticated" ON public.storage_chests FOR SELECT TO authenticated USING (true);

CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chest_id uuid REFERENCES public.storage_chests(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'pcs',
  min_threshold integer NOT NULL DEFAULT 0,
  updated_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_items readable by authenticated" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_stock_items_item_name ON public.stock_items(item_name);
CREATE INDEX idx_stock_items_chest ON public.stock_items(chest_id);

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_discord_id text NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending',
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  decided_by_discord_id text,
  decided_by_username text,
  decided_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.material_requests TO authenticated;
GRANT ALL ON public.material_requests TO service_role;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_requests readable by authenticated" ON public.material_requests FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_material_requests_member ON public.material_requests(member_discord_id, status);
CREATE INDEX idx_material_requests_status ON public.material_requests(status);

CREATE TRIGGER trg_storage_chests_updated_at BEFORE UPDATE ON public.storage_chests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
