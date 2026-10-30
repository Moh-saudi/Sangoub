-- ==============================================================================
-- 🚀 SUPABASE STORAGE BUCKET FOR SANGOUB CATALOG IMAGES
-- ==============================================================================

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

-- Policies for public reading and authenticated uploading
DROP POLICY IF EXISTS "Public access to catalog images" ON storage.objects;
CREATE POLICY "Public access to catalog images" ON storage.objects
    FOR SELECT USING (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "Allow uploads to catalog images" ON storage.objects;
CREATE POLICY "Allow uploads to catalog images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "Allow updates to catalog images" ON storage.objects;
CREATE POLICY "Allow updates to catalog images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'catalog-images');

