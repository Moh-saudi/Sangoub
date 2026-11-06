-- Fields required by authenticated admin edits of the Supabase catalog.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_key text,
  ADD COLUMN IF NOT EXISTS banner_key text,
  ADD COLUMN IF NOT EXISTS image_key text;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

GRANT ALL ON public.stores, public.products, public.coupons TO service_role;
