-- ==============================================================================
-- 🐿️ SANGOUB (سنجوب) - هيكل أنواع المتاجر والأقسام (الإصدار 1.0)
-- Project Ref: tvnsqatkaqyubeznhnmu
-- متوافق بالكامل مع وثيقة المواصفات: Sangoub_Store_Taxonomy_Developer_Spec.md
-- ==============================================================================

-- 1. جدول أنواع المتاجر (Store Types)
CREATE TABLE IF NOT EXISTS public.store_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    image TEXT,
    sort_order INT DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول التخصصات الفرعية للمتاجر (Store Subtypes)
CREATE TABLE IF NOT EXISTS public.store_subtypes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_type_id UUID REFERENCES public.store_types(id) ON DELETE CASCADE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول قوالب الأقسام (Category Templates)
CREATE TABLE IF NOT EXISTS public.category_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_type_id UUID REFERENCES public.store_types(id) ON DELETE CASCADE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    image TEXT,
    sort_order INT DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول أقسام المتجر الفعلية (Store Categories)
CREATE TABLE IF NOT EXISTS public.store_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.category_templates(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.store_categories(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    image TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. تحديث جداول المتاجر والمنتجات الحالية للربط المعماري
ALTER TABLE public.stores 
    ADD COLUMN IF NOT EXISTS store_type_id UUID REFERENCES public.store_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS store_subtype_id UUID REFERENCES public.store_subtypes(id) ON DELETE SET NULL;

ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.store_categories(id) ON DELETE SET NULL;

-- 6. تفعيل الفهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_store_types_code ON public.store_types(code);
CREATE INDEX IF NOT EXISTS idx_store_subtypes_type ON public.store_subtypes(store_type_id);
CREATE INDEX IF NOT EXISTS idx_category_templates_type ON public.category_templates(store_type_id);
CREATE INDEX IF NOT EXISTS idx_store_categories_store ON public.store_categories(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- 7. تفعيل سياسات الأمان (Row Level Security - RLS)
ALTER TABLE public.store_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subtypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_types' AND policyname = 'Public read active store_types') THEN
        CREATE POLICY "Public read active store_types" ON public.store_types FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_subtypes' AND policyname = 'Public read store_subtypes') THEN
        CREATE POLICY "Public read store_subtypes" ON public.store_subtypes FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'category_templates' AND policyname = 'Public read category_templates') THEN
        CREATE POLICY "Public read category_templates" ON public.category_templates FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_categories' AND policyname = 'Public read store_categories') THEN
        CREATE POLICY "Public read store_categories" ON public.store_categories FOR SELECT USING (true);
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- 8. غرس بيانات أنواع المتاجر (16 مفعّلة في الإطلاق الأول + 3 مؤجلة)
-- ════════════════════════════════════════════════════════════════════════════════
INSERT INTO public.store_types (code, name_ar, name_en, image, sort_order, status)
VALUES
    -- الـ 16 نوعاً النشطة للإطلاق الأول
    ('GROC', 'السوبر ماركت والبقالة', 'Supermarkets & Groceries', '/categories/fruits_vegetables.jpg', 1, 'active'),
    ('PRODUCE', 'الخضروات والفواكه', 'Fruits & Vegetables Stores', '/categories/fruits_vegetables.jpg', 2, 'active'),
    ('BAKERY', 'المخابز والمخبوزات', 'Bakeries & Bread Shops', '/categories/bakery.jpg', 3, 'active'),
    ('BEVERAGE', 'المشروبات والعصائر', 'Beverages & Juice Shops', '/categories/beverages.jpg', 4, 'active'),
    ('HOME', 'مستلزمات المنزل', 'Home & Household Supplies', '/categories/home_essentials.jpg', 5, 'active'),
    ('CLEAN', 'المنظفات ومستلزمات النظافة', 'Cleaning & Hygiene Supplies', '/categories/cleaning_laundry.jpg', 6, 'active'),
    ('PERSONAL', 'العناية الشخصية', 'Personal Care', '/categories/personal_care.jpg', 7, 'active'),
    ('BABY', 'مستلزمات الأطفال', 'Baby & Infant Supplies', '/categories/baby_care.jpg', 8, 'active'),
    ('PET', 'مستلزمات الحيوانات الأليفة', 'Pet Supplies', '/categories/pet_care.jpg', 9, 'active'),
    ('FLOWER', 'الورود والهدايا', 'Flowers & Gifts', '/categories/seasonal_products.jpg', 10, 'active'),
    ('BEAUTY', 'التجميل والعطور', 'Beauty & Perfumes', '/categories/personal_care.jpg', 11, 'active'),
    ('ELECT', 'الإلكترونيات والإكسسوارات', 'Electronics & Accessories', '/categories/automotive.jpg', 12, 'active'),
    ('STATIONERY', 'المكتبات والأدوات المدرسية', 'Stationery & School Supplies', '/categories/stationery_school.jpg', 13, 'active'),
    ('AUTO', 'مستلزمات السيارات', 'Automotive Supplies', '/categories/automotive.jpg', 14, 'active'),
    ('OUTDOOR', 'مستلزمات الرحلات والخروج', 'Outdoor & Picnic Supplies', '/categories/picnic_outdoor.jpg', 15, 'active'),
    ('SEASONAL', 'مستلزمات المواسم والمناسبات', 'Seasonal & Occasion Supplies', '/categories/seasonal_products.jpg', 16, 'active'),
    
    -- الأنواع المؤجلة (تبقى في قاعدة البيانات لكن بحالة inactive ولا تظهر للعميل)
    ('REST', 'المطاعم', 'Restaurants', NULL, 90, 'inactive'),
    ('CAFE', 'الكافيهات', 'Cafés', NULL, 91, 'inactive'),
    ('PHARM', 'الصيدليات', 'Pharmacies', NULL, 92, 'inactive')
ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    image = EXCLUDED.image,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status;

-- ════════════════════════════════════════════════════════════════════════════════
-- 9. غرس التخصصات الفرعية الـ 34
-- ════════════════════════════════════════════════════════════════════════════════
INSERT INTO public.store_subtypes (store_type_id, code, name_ar, name_en, sort_order, status)
SELECT t.id, s.code, s.name_ar, s.name_en, s.sort_order, 'active'
FROM (VALUES
    -- GROC
    ('GROC', 'GROC-HYPER', 'هايبر ماركت', 'Hypermarket', 1),
    ('GROC', 'GROC-SUPER', 'سوبر ماركت', 'Supermarket', 2),
    ('GROC', 'GROC-MINI', 'ميني ماركت', 'Mini Market', 3),
    ('GROC', 'GROC-GROCERY', 'بقالة', 'Grocery Store', 4),
    -- PRODUCE
    ('PRODUCE', 'PRODUCE-FRUIT', 'محل فواكه', 'Fruit Shop', 1),
    ('PRODUCE', 'PRODUCE-VEG', 'محل خضروات', 'Vegetable Shop', 2),
    ('PRODUCE', 'PRODUCE-BOTH', 'خضروات وفواكه', 'Fruit & Vegetable Shop', 3),
    -- BAKERY
    ('BAKERY', 'BAKERY-BREAD', 'مخبز', 'Bread Bakery', 1),
    ('BAKERY', 'BAKERY-PASTRY', 'مخبوزات ومعجنات', 'Pastry Shop', 2),
    -- BEVERAGE
    ('BEVERAGE', 'BEV-JUICE', 'عصائر', 'Juice Shop', 1),
    ('BEVERAGE', 'BEV-DRINKS', 'مشروبات', 'Drinks Shop', 2),
    -- HOME
    ('HOME', 'HOME-KITCHEN', 'أدوات ومستلزمات المطبخ', 'Kitchen Supplies', 1),
    ('HOME', 'HOME-TOOLS', 'أدوات منزلية', 'Household Tools', 2),
    ('HOME', 'HOME-DECOR', 'ديكور ومفروشات', 'Home Décor', 3),
    -- CLEAN
    ('CLEAN', 'CLEAN-HOME', 'منظفات منزلية', 'Household Cleaning', 1),
    ('CLEAN', 'CLEAN-LAUNDRY', 'منظفات وغسيل', 'Laundry Supplies', 2),
    ('CLEAN', 'CLEAN-PAPER', 'ورقيات ومنتجات النظافة', 'Paper & Hygiene Products', 3),
    -- PERSONAL
    ('PERSONAL', 'PERSONAL-CARE', 'عناية شخصية', 'Personal Care', 1),
    -- BABY
    ('BABY', 'BABY-CARE', 'مستلزمات أطفال', 'Baby Supplies', 1),
    -- PET
    ('PET', 'PET-FOOD', 'أغذية الحيوانات', 'Pet Food', 1),
    ('PET', 'PET-SUPPLIES', 'مستلزمات الحيوانات', 'Pet Accessories & Supplies', 2),
    -- FLOWER
    ('FLOWER', 'FLOWER-ROSES', 'محلات ورد', 'Florists', 1),
    ('FLOWER', 'FLOWER-GIFTS', 'هدايا', 'Gift Shops', 2),
    -- BEAUTY
    ('BEAUTY', 'BEAUTY-COS', 'مستحضرات تجميل', 'Cosmetics', 1),
    ('BEAUTY', 'BEAUTY-PERFUME', 'عطور', 'Perfumes', 2),
    -- ELECT
    ('ELECT', 'ELECT-PHONES', 'هواتف وإكسسوارات', 'Phones & Accessories', 1),
    ('ELECT', 'ELECT-ACCESS', 'إكسسوارات إلكترونية', 'Electronic Accessories', 2),
    -- STATIONERY
    ('STATIONERY', 'STAT-SCHOOL', 'أدوات مدرسية', 'School Supplies', 1),
    ('STATIONERY', 'STAT-OFFICE', 'أدوات مكتبية', 'Office Supplies', 2),
    -- AUTO
    ('AUTO', 'AUTO-ACCESS', 'إكسسوارات سيارات', 'Car Accessories', 1),
    ('AUTO', 'AUTO-CARE', 'عناية بالسيارات', 'Car Care', 2),
    -- OUTDOOR
    ('OUTDOOR', 'OUT-PICNIC', 'مستلزمات رحلات ونزهات', 'Picnic Supplies', 1),
    -- SEASONAL
    ('SEASONAL', 'SEASON-EVENTS', 'مستلزمات مناسبات', 'Occasion Supplies', 1),
    ('SEASONAL', 'SEASON-RAMADAN', 'مستلزمات رمضان والمواسم', 'Ramadan & Seasonal Supplies', 2)
) AS s(type_code, code, name_ar, name_en, sort_order)
JOIN public.store_types t ON t.code = s.type_code
ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order;

-- ════════════════════════════════════════════════════════════════════════════════
-- 10. غرس قوالب أقسام المنتجات الـ 24 للسوبرماركت (GROC)
-- ════════════════════════════════════════════════════════════════════════════════
INSERT INTO public.category_templates (store_type_id, code, name_ar, name_en, image, sort_order, status)
SELECT t.id, c.code, c.name_ar, c.name_en, c.image, c.sort_order, 'active'
FROM (VALUES
    ('CAT-PRODUCE', 'الخضروات والفواكه', 'Fruits & Vegetables', '/categories/fruits_vegetables.jpg', 1),
    ('CAT-BAKERY', 'المخبوزات والخبز', 'Bakery & Bread', '/categories/bakery.jpg', 2),
    ('CAT-MEAT', 'اللحوم والدواجن', 'Meat & Poultry', '/categories/meat_poultry.jpg', 3),
    ('CAT-DAIRY', 'الألبان والبيض', 'Dairy & Eggs', '/categories/dairy_eggs.jpg', 4),
    ('CAT-DELI', 'الجبن واللانشون', 'Cheese & Deli', '/categories/cheese_deli.jpg', 5),
    ('CAT-PANTRY', 'البقالة والمواد الغذائية', 'Pantry & Groceries', '/categories/pantry_canned.jpg', 6),
    ('CAT-BREAKFAST', 'الفطار', 'Breakfast', '/categories/breakfast.jpg', 7),
    ('CAT-COOKING', 'الطبخ والخبز', 'Cooking & Baking', '/categories/cooking_baking.jpg', 8),
    ('CAT-FROZEN', 'الأطعمة المجمدة', 'Frozen Food', '/categories/frozen_food.jpg', 9),
    ('CAT-DIET', 'أغذية الحمية', 'Special Diet', '/categories/special_diet.jpg', 10),
    ('CAT-BEVERAGES', 'المشروبات', 'Beverages', '/categories/beverages.jpg', 11),
    ('CAT-COFFEE-TEA', 'القهوة والشاي', 'Coffee & Tea', '/categories/coffee_tea.jpg', 12),
    ('CAT-SNACKS', 'التسالي والشوكولاتة', 'Snacks & Chocolate', '/categories/snacks_chocolate.jpg', 13),
    ('CAT-ICECREAM', 'الآيس كريم', 'Ice Cream', '/categories/ice_cream.jpg', 14),
    ('CAT-CLEANING', 'المنظفات والغسيل', 'Cleaning & Laundry', '/categories/cleaning_laundry.jpg', 15),
    ('CAT-HOME', 'مستلزمات المنزل', 'Home & Household', '/categories/home_essentials.jpg', 16),
    ('CAT-PERSONAL', 'العناية الشخصية', 'Personal Care', '/categories/personal_care.jpg', 17),
    ('CAT-BABY', 'مستلزمات الأطفال', 'Baby Care', '/categories/baby_care.jpg', 18),
    ('CAT-PET', 'مستلزمات الحيوانات الأليفة', 'Pet Care', '/categories/pet_care.jpg', 19),
    ('CAT-DISPOSABLES', 'المستلزمات ذات الاستخدام الواحد', 'Disposables', '/categories/disposables.jpg', 20),
    ('CAT-STATIONERY', 'مستلزمات المكتب والمدرسة', 'Stationery & School', '/categories/stationery_school.jpg', 21),
    ('CAT-AUTO', 'مستلزمات السيارات', 'Automotive Supplies', '/categories/automotive.jpg', 22),
    ('CAT-OUTDOOR', 'مستلزمات الرحلات', 'Picnic & Outdoor', '/categories/picnic_outdoor.jpg', 23),
    ('CAT-SEASONAL', 'مستلزمات المواسم والمناسبات', 'Seasonal Products', '/categories/seasonal_products.jpg', 24)
) AS c(code, name_ar, name_en, image, sort_order)
JOIN public.store_types t ON t.code = 'GROC'
ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    image = EXCLUDED.image,
    sort_order = EXCLUDED.sort_order;

