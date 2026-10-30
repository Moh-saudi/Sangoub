-- ==============================================================================
-- 🚀 SANGOUB ENTERPRISE MULTI-VERTICAL CATALOG ARCHITECTURE
-- المعمارية المؤسسية المتقدمة لإدارة الكتالوجات والباركود وربط نقاط البيع (POS)
-- Project Ref: tvnsqatkaqyubeznhnmu
-- ==============================================================================

-- 1. تفعيل الإضافات
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. جدول الأنشطة التجارية والقطاعات (Catalog Verticals)
CREATE TABLE IF NOT EXISTS public.catalog_verticals (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    icon TEXT,
    requires_prescription BOOLEAN DEFAULT FALSE,
    supports_modifiers BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- زرع القطاعات الأساسية
INSERT INTO public.catalog_verticals (id, name_ar, icon, requires_prescription, supports_modifiers)
VALUES 
  ('restaurant', 'مطاعم ومأكولات', 'utensils', false, true),
  ('supermarket', 'سوبر ماركت وبقالة', 'shopping-cart', false, false),
  ('pharmacy', 'صيدلية وعناية شخصية', 'cross', true, false),
  ('toys', 'لعب أطفال ومستلزمات', 'puzzle-piece', false, false),
  ('retail', 'محلات منوعة وهدايا', 'tag', false, false)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  supports_modifiers = EXCLUDED.supports_modifiers;

-- 3. جدول الصنف الموحد العام القياسي (Master SPU)
CREATE TABLE IF NOT EXISTS public.master_spu (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vertical_id TEXT REFERENCES public.catalog_verticals(id) ON DELETE RESTRICT NOT NULL,
    primary_barcode TEXT,
    brand_name TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    specifications JSONB DEFAULT '{}'::jsonb,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_spu_barcode ON public.master_spu(primary_barcode);
CREATE INDEX IF NOT EXISTS idx_master_spu_name_trgm ON public.master_spu USING gin(name_ar gin_trgm_ops);

-- 4. جدول عروض المتاجر (Store Offers - SKU Level)
CREATE TABLE IF NOT EXISTS public.store_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    spu_id UUID REFERENCES public.master_spu(id) ON DELETE SET NULL,
    merchant_pos_sku TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    discount_price NUMERIC(10, 2),
    is_available BOOLEAN DEFAULT TRUE,
    track_inventory BOOLEAN DEFAULT FALSE,
    stock_qty INT DEFAULT 0,
    custom_display_name TEXT,
    custom_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, merchant_pos_sku)
);

CREATE INDEX IF NOT EXISTS idx_store_offers_store ON public.store_offers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_offers_sku ON public.store_offers(merchant_pos_sku);

-- 5. جدول محول الباركود المتعدد للكاشير (Barcode Mapping Adapter)
CREATE TABLE IF NOT EXISTS public.store_offer_barcodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES public.store_offers(id) ON DELETE CASCADE NOT NULL,
    barcode TEXT NOT NULL,
    barcode_type TEXT CHECK (barcode_type IN ('international', 'scale_weighted', 'internal_label')) DEFAULT 'international',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(offer_id, barcode)
);

CREATE INDEX IF NOT EXISTS idx_store_offer_barcodes ON public.store_offer_barcodes(barcode);

-- 6. محرك خيارات وتخصيص الوجبات والمطاعم (Modifiers Hierarchy)
CREATE TABLE IF NOT EXISTS public.product_modifier_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES public.store_offers(id) ON DELETE CASCADE NOT NULL,
    title_ar TEXT NOT NULL,
    min_selection INT DEFAULT 0,
    max_selection INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_modifier_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.product_modifier_groups(id) ON DELETE CASCADE NOT NULL,
    name_ar TEXT NOT NULL,
    extra_price NUMERIC(10, 2) DEFAULT 0.00,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. العرض الموحد للعميل والفرونت إند (Consolidated Consumer View)
CREATE OR REPLACE VIEW public.vw_store_catalog AS
SELECT 
    o.id AS offer_id,
    o.store_id,
    o.merchant_pos_sku,
    COALESCE(o.custom_display_name, s.name_ar) AS display_name,
    COALESCE(o.custom_image_url, s.images->>0) AS display_image,
    o.base_price,
    o.discount_price,
    o.is_available,
    o.track_inventory,
    o.stock_qty,
    s.id AS spu_id,
    s.vertical_id,
    s.brand_name,
    s.primary_barcode,
    s.description,
    s.specifications,
    EXISTS (
        SELECT 1 FROM public.product_modifier_groups mg WHERE mg.offer_id = o.id
    ) AS has_modifiers
FROM public.store_offers o
LEFT JOIN public.master_spu s ON o.spu_id = s.id;

-- 8. سياسات الأمان والحماية (Row Level Security - RLS)
ALTER TABLE public.catalog_verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_spu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_offer_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_items ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة العامة
DROP POLICY IF EXISTS "Public can view verticals" ON public.catalog_verticals;
CREATE POLICY "Public can view verticals" ON public.catalog_verticals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view master SPU" ON public.master_spu;
CREATE POLICY "Public can view master SPU" ON public.master_spu FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view store offers" ON public.store_offers;
CREATE POLICY "Public can view store offers" ON public.store_offers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view offer barcodes" ON public.store_offer_barcodes;
CREATE POLICY "Public can view offer barcodes" ON public.store_offer_barcodes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view modifier groups" ON public.product_modifier_groups;
CREATE POLICY "Public can view modifier groups" ON public.product_modifier_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view modifier items" ON public.product_modifier_items;
CREATE POLICY "Public can view modifier items" ON public.product_modifier_items FOR SELECT USING (true);

