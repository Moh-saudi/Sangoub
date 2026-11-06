-- ==============================================================================
-- 🚀 SANGOUB COMPREHENSIVE PRODUCTION REPAIR: STORES, AUDIT LOGS & IMAGES
-- ==============================================================================
-- Run this script in the Supabase SQL Editor if you experience issues with:
-- 1) Merchant / store profile saves failing
-- 2) Store logo / banner uploads failing
-- 3) Missing audit log table or storage bucket

-- 1. Ensure `stores` table has all compatibility columns and defaults
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN DEFAULT TRUE;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_registration_number TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;

-- Backfill compatibility columns from existing logo and banner
UPDATE public.stores 
SET 
  logo_url = COALESCE(logo_url, logo),
  banner_url = COALESCE(banner_url, banner),
  tax_registration_number = COALESCE(tax_registration_number, tax_number)
WHERE logo_url IS NULL OR banner_url IS NULL;

-- 2. Ensure `audit_logs` table exists for audit tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_state JSONB,
    after_state JSONB,
    source TEXT DEFAULT 'system',
    status TEXT DEFAULT 'success',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role full control over audit_logs
DROP POLICY IF EXISTS "Service role manages audit logs" ON public.audit_logs;
CREATE POLICY "Service role manages audit logs" ON public.audit_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to insert audit records (e.g. actions from app)
DROP POLICY IF EXISTS "Authenticated users insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow admins to read audit logs
DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND public.profiles.role = 'admin'
      )
    );

GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- 3. Ensure `catalog-images` Supabase Storage Bucket exists with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'catalog-images',
    'catalog-images',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage bucket access policies
DROP POLICY IF EXISTS "Public access to catalog images" ON storage.objects;
CREATE POLICY "Public access to catalog images" ON storage.objects
    FOR SELECT USING (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "Authenticated upload to catalog images" ON storage.objects;
CREATE POLICY "Authenticated upload to catalog images" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "Authenticated update to catalog images" ON storage.objects;
CREATE POLICY "Authenticated update to catalog images" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "Service role manage catalog images" ON storage.objects;
CREATE POLICY "Service role manage catalog images" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'catalog-images') WITH CHECK (bucket_id = 'catalog-images');

-- 4. Enable admin writes on `stores` for authenticated admins directly as well
DROP POLICY IF EXISTS "Admins update stores" ON public.stores;
CREATE POLICY "Admins update stores" ON public.stores
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND public.profiles.role = 'admin'
      )
    );

DROP POLICY IF EXISTS "Admins insert stores" ON public.stores;
CREATE POLICY "Admins insert stores" ON public.stores
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE public.profiles.id = auth.uid() 
        AND public.profiles.role = 'admin'
      )
    );
