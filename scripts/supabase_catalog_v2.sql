-- Catalog and merchant-operation fields used by the Supabase merchant API.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS prices_include_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_registration_number text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vertical_id text,
  ADD COLUMN IF NOT EXISTS image_key text,
  ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  ADD COLUMN IF NOT EXISTS min_stock_alert integer NOT NULL DEFAULT 0 CHECK (min_stock_alert >= 0),
  ADD COLUMN IF NOT EXISTS max_per_order integer NOT NULL DEFAULT 99 CHECK (max_per_order >= 1),
  ADD COLUMN IF NOT EXISTS catalog_product_id text,
  ADD COLUMN IF NOT EXISTS offer_title text,
  ADD COLUMN IF NOT EXISTS is_occasion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS occasion_name text,
  ADD COLUMN IF NOT EXISTS offer_start_date text,
  ADD COLUMN IF NOT EXISTS offer_end_date text;

CREATE INDEX IF NOT EXISTS products_store_active_id_idx
  ON public.products(store_id,id) WHERE archived=false;
CREATE INDEX IF NOT EXISTS orders_store_ids_gin_idx
  ON public.orders USING gin(store_ids);

GRANT ALL ON public.stores, public.products TO service_role;
