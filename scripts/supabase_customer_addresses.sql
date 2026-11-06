CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'عنواني',
  city text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  full_address text NOT NULL,
  details text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  coordinates jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'عنواني',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS district text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS details text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS customer_addresses_owner_idx ON public.customer_addresses(customer_id, created_at DESC);
WITH ranked_defaults AS (
  SELECT id, row_number() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, created_at DESC, id) AS position
  FROM public.customer_addresses WHERE is_default AND customer_id IS NOT NULL
)
UPDATE public.customer_addresses AS address SET is_default = false
FROM ranked_defaults WHERE address.id = ranked_defaults.id AND ranked_defaults.position > 1;
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_uidx ON public.customer_addresses(customer_id) WHERE is_default;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own customer addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Users can insert own customer addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Users can update own customer addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Users can delete own customer addresses" ON public.customer_addresses;
CREATE POLICY "Users can view own customer addresses" ON public.customer_addresses FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Users can insert own customer addresses" ON public.customer_addresses FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Users can update own customer addresses" ON public.customer_addresses FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Users can delete own customer addresses" ON public.customer_addresses FOR DELETE TO authenticated USING (customer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.save_customer_address(p_address jsonb, p_make_default boolean DEFAULT false)
RETURNS public.customer_addresses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result public.customer_addresses%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NULLIF(btrim(p_address->>'fullAddress'),'') IS NULL THEN RAISE EXCEPTION 'ADDRESS_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF p_make_default THEN
    UPDATE public.customer_addresses SET is_default = false, updated_at = now()
      WHERE customer_id = v_user AND is_default;
  END IF;
  INSERT INTO public.customer_addresses(customer_id,title,city,district,street,full_address,details,notes,coordinates,is_default)
  VALUES (
    v_user,COALESCE(NULLIF(btrim(p_address->>'title'),''),'عنواني'),COALESCE(p_address->>'city',''),
    COALESCE(p_address->>'district',''),COALESCE(p_address->>'street',''),btrim(p_address->>'fullAddress'),
    COALESCE(p_address->>'details',''),COALESCE(p_address->>'notes',''),p_address->'coordinates',p_make_default
  ) RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_customer_address(jsonb,boolean) TO authenticated;
