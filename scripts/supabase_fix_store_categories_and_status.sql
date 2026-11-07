-- ==============================================================================
-- 🚀 SANGOUB DATABASE MAINTENANCE: STORE CATEGORIES & STATUS RELAXATION
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to ensure:
-- 1) Any store category (restaurant, seafood, cafe, bakery, supermarket, pharmacy) is allowed
-- 2) Store status ('open', 'busy', 'closed') is verified and defaults to 'open'
-- 3) Compatibility columns are all present

-- 1. Remove restrictive CHECK constraints on `category` if they exist
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.stores'::regclass 
        AND contype = 'c' 
        AND conname LIKE '%category%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.stores DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. Ensure `status` allows 'open', 'busy', 'closed'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.stores'::regclass 
        AND contype = 'c' 
        AND conname LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.stores DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.stores ADD CONSTRAINT stores_status_check CHECK (status IN ('open', 'busy', 'closed'));
ALTER TABLE public.stores ALTER COLUMN status SET DEFAULT 'open';

-- 3. Ensure compatibility columns exist
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN DEFAULT TRUE;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_registration_number TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS location_in_district TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;

-- 4. Enable RLS and Admin Policies
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view stores" ON public.stores;
CREATE POLICY "Public can view stores" ON public.stores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update stores" ON public.stores;
CREATE POLICY "Admins can update stores" ON public.stores
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND public.profiles.role = 'admin'
      )
    );

DROP POLICY IF EXISTS "Admins can insert stores" ON public.stores;
CREATE POLICY "Admins can insert stores" ON public.stores
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND public.profiles.role = 'admin'
      )
    );

-- 5. Products table check: Ensure products are readable by everyone
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products" ON public.products
    FOR SELECT USING (true);

