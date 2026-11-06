
-- === APPLY: scripts/supabase_schema.sql ===
-- ==============================================================================
-- 🚀 SANGOUB - SUPABASE POSTGRESQL COMPLETE DATABASE SCHEMA
-- مخطط قاعدة بيانات مشروع سنجوب الشامل على منصة Supabase
-- Project Ref: tvnsqatkaqyubeznhnmu
-- ==============================================================================

-- 1. تفعيل الإضافات الأساسية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. جدول الحسابات الشخصية (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    role TEXT CHECK (role IN ('employee', 'restaurant', 'courier', 'admin')) DEFAULT 'employee',
    ministry TEXT,
    floor_number TEXT,
    room_number TEXT,
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
    avatar_url TEXT,
    -- بيانات المندوب الخاصة
    vehicle_type TEXT CHECK (vehicle_type IN ('motorcycle', 'bicycle', 'car', 'auto')),
    vehicle_plate TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    courier_status TEXT CHECK (courier_status IN ('active', 'pending', 'suspended')) DEFAULT 'pending',
    has_thermal_box BOOLEAN DEFAULT FALSE,
    has_thermal_backpack BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول المتاجر والمطاعم (Stores)
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    type TEXT DEFAULT 'مطعم',
    category TEXT CHECK (category IN ('breakfast', 'sandwiches', 'supermarket', 'cafe', 'desserts')) DEFAULT 'breakfast',
    logo TEXT,
    banner TEXT,
    status TEXT CHECK (status IN ('open', 'busy', 'closed')) DEFAULT 'open',
    rating NUMERIC(3, 2) DEFAULT 5.00,
    rating_count INT DEFAULT 0,
    delivery_time TEXT DEFAULT '15-20 دقيقة',
    min_order NUMERIC(10, 2) DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) DEFAULT 10.00,
    location_in_district TEXT,
    precise_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    coverage_radius_km NUMERIC(5, 2) DEFAULT 5.00,
    commission_rate NUMERIC(5, 2) DEFAULT 10.00,
    tax_rate NUMERIC(5, 2) DEFAULT 14.00,
    commercial_register TEXT,
    tax_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول المنتجات والوجبات (Products)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    original_price NUMERIC(10, 2),
    category TEXT NOT NULL DEFAULT 'فطور',
    badge TEXT,
    image_url TEXT,
    image_type TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    archived BOOLEAN DEFAULT FALSE,
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول الطلبات (Orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL NOT NULL,
    courier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN (
        'pending', 'accepted', 'preparing', 'ready', 
        'assigned', 'picked_up', 'delivered', 'cancelled'
    )) DEFAULT 'pending',
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_address TEXT,
    delivery_lat DOUBLE PRECISION,
    delivery_lng DOUBLE PRECISION,
    delivery_ministry TEXT,
    delivery_floor TEXT,
    delivery_room TEXT,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. جدول عناصر الطلب (Order Items)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    selected_options JSONB DEFAULT '{}'::jsonb
);

-- 7. جدول تتبع موقع المندوب اللحظي (Courier Locations)
CREATE TABLE IF NOT EXISTS public.courier_locations (
    courier_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    is_online BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. جدول الإشعارات (Notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'order',
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. تفعيل التحديث التلقائي اللحظي (Realtime) بطريقة آمنة عند إعادة التشغيل
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='courier_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 10. تفعيل سياسات الأمان (Row Level Security - RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- سياسات أقل صلاحية: بيانات الملف خاصة، والطلبات تنشأ عبر RPC الخادم فقط.
REVOKE ALL ON public.profiles, public.orders, public.order_items, public.courier_locations, public.notifications FROM anon, authenticated;
GRANT SELECT ON public.stores, public.products TO anon, authenticated;
GRANT SELECT ON public.profiles, public.orders, public.order_items, public.courier_locations, public.notifications TO authenticated;
GRANT UPDATE (full_name, phone, email, ministry, floor_number, room_number, avatar_url, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles, public.orders, public.order_items, public.courier_locations, public.notifications TO service_role;

DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Stores viewable by everyone" ON public.stores;
DROP POLICY IF EXISTS "Store owners can update their store" ON public.stores;
DROP POLICY IF EXISTS "Products viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Users can view relevant orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Order items viewable with order" ON public.order_items;
DROP POLICY IF EXISTS "Courier location readable by all authenticated" ON public.courier_locations;
DROP POLICY IF EXISTS "Courier can update own location" ON public.courier_locations;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Profile owner reads own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profile owner updates safe fields" ON public.profiles;
DROP POLICY IF EXISTS "Public reads stores" ON public.stores;
DROP POLICY IF EXISTS "Public reads products" ON public.products;
DROP POLICY IF EXISTS "Order participants read orders" ON public.orders;
DROP POLICY IF EXISTS "Order participants read items" ON public.order_items;
DROP POLICY IF EXISTS "Customer reads assigned courier location" ON public.courier_locations;
DROP POLICY IF EXISTS "Owner reads notifications" ON public.notifications;

CREATE POLICY "Profile owner reads own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profile owner updates safe fields" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Public reads stores" ON public.stores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public reads products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Order participants read orders" ON public.orders FOR SELECT TO authenticated USING (
  customer_id = auth.uid() OR courier_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = orders.store_id AND stores.owner_id = auth.uid()
  )
);
CREATE POLICY "Order participants read items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND
    (orders.customer_id = auth.uid() OR orders.courier_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.stores WHERE stores.id = orders.store_id AND stores.owner_id = auth.uid()
    )))
);
CREATE POLICY "Customer reads assigned courier location" ON public.courier_locations FOR SELECT TO authenticated USING (
  courier_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.orders WHERE orders.courier_id = courier_locations.courier_id
      AND orders.customer_id = auth.uid() AND orders.status = 'with_courier'
  )
);
CREATE POLICY "Owner reads notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Direct order and location mutations bypass server-side pricing/authorization checks.
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items, public.courier_locations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;

-- 11. دالة ترحيل المستخدم عند التسجيل التلقائي من Supabase Auth إلى جدول profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    new.email,
    new.phone,
    'employee'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- مشغل الدالة (Trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- === APPLY: scripts/supabase_categories_v1.sql ===
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


-- === APPLY: scripts/supabase_customer_addresses.sql ===
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

-- === APPLY: scripts/supabase_catalog_v2.sql ===
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

-- === APPLY: scripts/supabase_orders_v2.sql ===
-- Pre-launch order model migration. Apply to Supabase before deploying the
-- matching /api/orders handler changes.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS store_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS restaurant_name text,
  ADD COLUMN IF NOT EXISTS discount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_tax numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_tax numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS kitchen_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfillment_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS estimated_delivery text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS departed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_phone text,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_delivery_time text,
  ADD COLUMN IF NOT EXISTS courier_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS picked_up_store_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extra_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.courier_verification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  national_id text NOT NULL,
  emergency_phone text NOT NULL,
  current_address text NOT NULL,
  id_card_address text NOT NULL,
  driving_license_number text,
  license_issue_date date,
  license_expiry_date date,
  vehicle_year text,
  drug_test_status text CHECK (drug_test_status IN ('passed','failed','pending')),
  drug_test_date date,
  criminal_record_status text CHECK (criminal_record_status IN ('passed','failed','pending')),
  criminal_record_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_verification ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_verification FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_verification TO service_role;

DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass AND contype = 'c'
  LOOP
    IF item.definition ~* '(^|[ (])status([ )]|$)' AND item.definition NOT ILIKE '%payment_status%' THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', item.conname);
    ELSIF item.definition ILIKE '%payment_status%' THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', item.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_sangoub_check
    CHECK (status IN ('pending','accepted','received','preparing','ready','assigned','picked_up','with_courier','delivered','cancelled')),
  ADD CONSTRAINT orders_payment_status_sangoub_check
    CHECK (payment_status IN ('pending','paid','failed','refunded','cash_on_delivery'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_request_id_uidx
  ON public.orders(customer_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_created_idx
  ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_courier_active_idx
  ON public.orders(courier_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_active_idx
  ON public.orders(store_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coupons (
  code text PRIMARY KEY,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  value numeric(10,2) NOT NULL CHECK (value >= 0),
  min_order numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_uses IS NULL OR max_uses >= 0)
);

CREATE TABLE IF NOT EXISTS public.order_limits (
  customer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.order_secrets (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  otp_code text NOT NULL CHECK (otp_code ~ '^[0-9]{4}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_fulfillments (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','preparing','ready','picked_up','cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  issue text,
  issue_open boolean NOT NULL DEFAULT false,
  resolution text,
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_by_name text,
  ready_at timestamptz,
  picked_up_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  picked_up_by_name text,
  picked_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id,store_id)
);
CREATE INDEX IF NOT EXISTS order_fulfillments_store_status_idx ON public.order_fulfillments(store_id,status,created_at DESC);
ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_fulfillments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_fulfillments TO service_role;

CREATE TABLE IF NOT EXISTS public.order_payments (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('creating','ready','uncertain','paid')),
  reference_id text UNIQUE,
  provider_id text UNIQUE,
  session_id text,
  redirect_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.geidea_transactions (
  provider_id text PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geidea_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_payments, public.geidea_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments, public.geidea_transactions TO service_role;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'api',
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO service_role;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')
  )
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_limits, public.order_secrets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_limits, public.order_secrets TO service_role;

CREATE OR REPLACE FUNCTION public.create_sangoub_order(
  p_customer_id uuid,
  p_request_id text,
  p_order jsonb,
  p_items jsonb,
  p_otp text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_count integer;
  v_coupon public.coupons%ROWTYPE;
  v_coupon_code text := NULLIF(p_order->>'couponCode','');
BEGIN
  IF p_customer_id IS NULL OR p_request_id IS NULL OR length(p_request_id) > 128 OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ORDER_INPUT' USING ERRCODE = '22023';
  END IF;
  IF p_otp !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'INVALID_OTP' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_existing FROM public.orders
  WHERE customer_id = p_customer_id AND client_request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('created', false, 'order', to_jsonb(v_existing));
  END IF;

  INSERT INTO public.order_limits(customer_id,window_started_at,request_count)
  VALUES (p_customer_id,now(),1)
  ON CONFLICT (customer_id) DO UPDATE SET
    window_started_at = CASE WHEN public.order_limits.window_started_at < now() - interval '24 hours' THEN now() ELSE public.order_limits.window_started_at END,
    request_count = CASE WHEN public.order_limits.window_started_at < now() - interval '24 hours' THEN 1 ELSE public.order_limits.request_count + 1 END
  RETURNING request_count INTO v_count;
  IF v_count > 30 THEN RAISE EXCEPTION 'ORDER_RATE_LIMIT' USING ERRCODE = 'P0001'; END IF;

  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE code = v_coupon_code FOR UPDATE;
    IF NOT FOUND OR NOT v_coupon.active OR (v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now())
       OR (v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now())
       OR (v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses)
       OR COALESCE((p_order->>'subtotal')::numeric,0) < v_coupon.min_order THEN
      RAISE EXCEPTION 'COUPON_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.coupons SET used_count = used_count + 1, updated_at = now() WHERE code = v_coupon_code;
  END IF;

  INSERT INTO public.orders (
    customer_id,client_request_id,order_number,customer_name,customer_phone,store_id,store_ids,restaurant_name,
    status,subtotal,delivery_fee,total_amount,discount,tip,tax_total,included_tax,additional_tax,
    delivery_address,delivery_lat,delivery_lng,coordinates,delivery_ministry,delivery_floor,delivery_room,
    payment_method,payment_status,notes,coupon_code,kitchen_status,fulfillment_version,estimated_delivery,
    is_scheduled,scheduled_delivery_time,created_at,updated_at
  ) VALUES (
    p_customer_id,p_request_id,NULLIF(p_order->>'orderNumber',''),NULLIF(p_order->>'profileName',''),NULLIF(p_order->>'phone',''),
    (p_order->'storeIds'->>0)::uuid,ARRAY(SELECT jsonb_array_elements_text(p_order->'storeIds')::uuid),
    NULLIF(p_order->>'restaurantName',''),COALESCE(NULLIF(p_order->>'orderStatus',''),'received'),
    COALESCE((p_order->>'subtotal')::numeric,0),COALESCE((p_order->>'deliveryFee')::numeric,0),COALESCE((p_order->>'total')::numeric,0),
    COALESCE((p_order->>'discount')::numeric,0),COALESCE((p_order->>'tip')::numeric,0),COALESCE((p_order->>'taxTotal')::numeric,0),
    COALESCE((p_order->>'includedTax')::numeric,0),COALESCE((p_order->>'additionalTax')::numeric,0),
    NULLIF(p_order->>'deliveryAddress',''),(p_order->'coordinates'->>'latitude')::double precision,(p_order->'coordinates'->>'longitude')::double precision,
    NULLIF(p_order->'coordinates','null'::jsonb),NULLIF(p_order->>'ministry',''),NULLIF(p_order->>'floorNumber',''),NULLIF(p_order->>'roomNumber',''),
    COALESCE(NULLIF(p_order->>'paymentMethod',''),'cash'),
    CASE WHEN p_order->>'paymentMethod' = 'cash' THEN 'cash_on_delivery' ELSE 'pending' END,
    NULLIF(p_order->>'notes',''),v_coupon_code,COALESCE(p_order->'kitchenStatus','{}'::jsonb),2,
    NULLIF(p_order->>'estimatedDelivery',''),COALESCE((p_order->>'isScheduled')::boolean,false),NULLIF(p_order->>'scheduledDeliveryTime',''),now(),now()
  ) RETURNING * INTO v_order;

  INSERT INTO public.order_items(order_id,product_id,product_name,price,quantity,selected_options,store_id,extra_price,notes)
  SELECT v_order.id,NULLIF(item->'product'->>'id','')::uuid,
    COALESCE(item->'product'->>'name','صنف'),COALESCE((item->'product'->>'price')::numeric,0),
    COALESCE((item->>'quantity')::integer,1),COALESCE(item->'selectedOptions','{}'::jsonb),
    NULLIF(item->'product'->>'storeId','')::uuid,COALESCE((item->>'extraPrice')::numeric,0),NULLIF(item->>'notes','')
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO public.order_fulfillments(order_id,store_id,items)
  SELECT v_order.id,(item->'product'->>'storeId')::uuid,jsonb_agg(item)
  FROM jsonb_array_elements(p_items) AS item
  GROUP BY (item->'product'->>'storeId')::uuid;

  INSERT INTO public.order_secrets(order_id,otp_code) VALUES(v_order.id,p_otp);
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
    VALUES(p_customer_id,'orders.create','orders',v_order.id::text,jsonb_build_object('status',v_order.status,'total',v_order.total_amount),'orders-api');
  RETURN jsonb_build_object('created', true, 'order', to_jsonb(v_order));
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_sangoub_delivery(
  p_order_id uuid,
  p_courier_id uuid,
  p_otp text,
  p_collected_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_secret public.order_secrets%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.courier_id IS DISTINCT FROM p_courier_id THEN RETURN jsonb_build_object('status',403,'error','NOT_ASSIGNED'); END IF;
  IF v_order.status = 'delivered' THEN RETURN jsonb_build_object('status',200,'ok',true); END IF;
  IF v_order.status <> 'with_courier' THEN RETURN jsonb_build_object('status',409,'error','ORDER_NOT_READY_FOR_DELIVERY'); END IF;
  IF EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id = p_order_id AND (status <> 'picked_up' OR picked_up_by IS DISTINCT FROM p_courier_id))
     OR NOT EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('status',409,'error','PICKUP_INCOMPLETE');
  END IF;
  SELECT * INTO v_secret FROM public.order_secrets WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',409,'error','OTP_UNAVAILABLE'); END IF;
  IF v_secret.locked_until IS NOT NULL AND v_secret.locked_until > now() THEN
    RETURN jsonb_build_object('status',429,'error','OTP_LOCKED');
  END IF;
  IF p_otp IS NULL OR p_otp !~ '^[0-9]{4}$' OR p_otp <> v_secret.otp_code THEN
    UPDATE public.order_secrets SET attempts = CASE WHEN attempts + 1 >= 5 THEN 0 ELSE attempts + 1 END,
      locked_until = CASE WHEN attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
      WHERE order_id = p_order_id;
    RETURN jsonb_build_object('status',400,'error','OTP_INVALID');
  END IF;
  IF v_order.payment_method = 'cash' THEN
    IF p_collected_amount IS NULL OR abs(p_collected_amount - v_order.total_amount) > 0.01 THEN
      RETURN jsonb_build_object('status',400,'error','CASH_AMOUNT_MISMATCH');
    END IF;
  ELSIF v_order.payment_status <> 'paid' OR COALESCE(p_collected_amount,0) <> 0 THEN
    RETURN jsonb_build_object('status',400,'error','PAYMENT_NOT_CONFIRMED');
  END IF;

  UPDATE public.orders SET status='delivered',delivered_at=now(),updated_at=now(),payment_status='paid',
    courier_checklist=jsonb_build_object('collectedPayment',true,'collectedAmount',p_collected_amount,'arrivedAtCustomerOffice',true)
    WHERE id=p_order_id;
  DELETE FROM public.order_secrets WHERE order_id=p_order_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
    VALUES(p_courier_id,'orders.delivered','orders',p_order_id::text,jsonb_build_object('status',v_order.status,'payment_status',v_order.payment_status),jsonb_build_object('status','delivered','payment_status','paid','collectedAmount',p_collected_amount),'order-delivery-api');
  RETURN jsonb_build_object('status',200,'ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sangoub_order_otp(p_order_id uuid,p_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_otp text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id=p_order_id AND customer_id=p_customer_id AND status NOT IN ('cancelled','delivered')
  ) THEN RETURN NULL; END IF;
  SELECT otp_code INTO v_otp FROM public.order_secrets WHERE order_id=p_order_id;
  RETURN v_otp;
END;
$$;

CREATE OR REPLACE FUNCTION public.pickup_sangoub_order_store(p_order_id uuid,p_store_id uuid,p_courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.orders%ROWTYPE; v_ticket public.order_fulfillments%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.courier_id IS DISTINCT FROM p_courier_id THEN RETURN jsonb_build_object('status',403,'error','NOT_ASSIGNED'); END IF;
  SELECT * INTO v_ticket FROM public.order_fulfillments WHERE order_id=p_order_id AND store_id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','STORE_NOT_ASSIGNED'); END IF;
  IF v_ticket.status='picked_up' AND v_ticket.picked_up_by=p_courier_id THEN RETURN jsonb_build_object('status',200,'ok',true); END IF;
  IF v_order.status <> 'ready' OR v_ticket.status <> 'ready' OR v_ticket.issue_open OR NOT (v_order.payment_method='cash' OR v_order.payment_status='paid')
    THEN RETURN jsonb_build_object('status',409,'error','STORE_NOT_READY'); END IF;
  UPDATE public.order_fulfillments SET status='picked_up',picked_up_by=p_courier_id,picked_up_at=now(),updated_at=now()
    WHERE order_id=p_order_id AND store_id=p_store_id;
  UPDATE public.orders SET picked_up_store_ids=array_append(picked_up_store_ids,p_store_id),updated_at=now()
    WHERE id=p_order_id AND NOT (p_store_id=ANY(picked_up_store_ids));
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
    VALUES(p_courier_id,'fulfillment.picked_up','orders',p_order_id::text,jsonb_build_object('storeId',p_store_id),'operations-api');
  RETURN jsonb_build_object('status',200,'ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.depart_sangoub_order(p_order_id uuid,p_courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.courier_id IS DISTINCT FROM p_courier_id THEN RETURN jsonb_build_object('status',403,'error','NOT_ASSIGNED'); END IF;
  IF v_order.status='with_courier' THEN RETURN jsonb_build_object('status',200,'ok',true); END IF;
  IF v_order.status <> 'ready' OR NOT (v_order.payment_method='cash' OR v_order.payment_status='paid')
    OR NOT EXISTS(SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id)
    OR EXISTS(SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND status <> 'picked_up')
    THEN RETURN jsonb_build_object('status',409,'error','PICKUP_INCOMPLETE'); END IF;
  UPDATE public.orders SET status='with_courier',departed_at=now(),updated_at=now() WHERE id=p_order_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
    VALUES(p_courier_id,'orders.departed','orders',p_order_id::text,jsonb_build_object('status',v_order.status),jsonb_build_object('status','with_courier'),'operations-api');
  RETURN jsonb_build_object('status',200,'ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_sangoub_payment(p_order_id uuid,p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND customer_id=p_customer_id FOR UPDATE;
  IF NOT FOUND OR v_order.payment_method <> 'geidea' OR v_order.status='cancelled' THEN
    RETURN jsonb_build_object('state','invalid');
  END IF;
  IF v_order.payment_status='paid' THEN RETURN jsonb_build_object('state','paid'); END IF;
  SELECT * INTO v_payment FROM public.order_payments WHERE order_id=p_order_id FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('state',v_payment.state,'referenceId',v_payment.reference_id,'sessionId',v_payment.session_id,'redirectUrl',v_payment.redirect_url,'providerId',v_payment.provider_id,'amount',v_order.total_amount,'customerName',v_order.customer_name); END IF;
  INSERT INTO public.order_payments(order_id,state) VALUES(p_order_id,'creating') RETURNING * INTO v_payment;
  RETURN jsonb_build_object('state','new','amount',v_order.total_amount,'customerName',v_order.customer_name,'referenceId',v_payment.reference_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_sangoub_payment_session(
  p_order_id uuid,p_state text,p_reference_id text DEFAULT NULL,p_provider_id text DEFAULT NULL,p_session_id text DEFAULT NULL,p_redirect_url text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_state NOT IN ('ready','uncertain') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE'; END IF;
  UPDATE public.order_payments SET state=p_state,reference_id=p_reference_id,provider_id=p_provider_id,session_id=p_session_id,redirect_url=p_redirect_url,updated_at=now()
    WHERE order_id=p_order_id AND state='creating';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sangoub_payment(
  p_order_id uuid,p_provider_id text,p_reference_id text,p_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
  v_claimed uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.payment_method <> 'geidea' OR v_order.order_number IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_payment FROM public.order_payments WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_payment.reference_id IS DISTINCT FROM p_reference_id THEN RETURN false; END IF;
  IF round(v_order.total_amount,2) <> round(p_amount,2) THEN RETURN false; END IF;
  IF v_order.payment_status='paid' THEN RETURN v_payment.provider_id=p_provider_id; END IF;
  INSERT INTO public.geidea_transactions(provider_id,order_id) VALUES(p_provider_id,p_order_id) ON CONFLICT DO NOTHING;
  SELECT order_id INTO v_claimed FROM public.geidea_transactions WHERE provider_id=p_provider_id;
  IF v_claimed IS DISTINCT FROM p_order_id THEN RETURN false; END IF;
  UPDATE public.orders SET payment_status='paid',payment_confirmed_at=now(),updated_at=now() WHERE id=p_order_id;
  UPDATE public.order_payments SET state='paid',provider_id=p_provider_id,updated_at=now() WHERE order_id=p_order_id;
  INSERT INTO public.audit_logs(action,entity_type,entity_id,before_state,after_state,source)
    VALUES('payment.confirmed','orders',p_order_id::text,jsonb_build_object('payment_status',v_order.payment_status),jsonb_build_object('payment_status','paid','providerId',p_provider_id),'geidea-callback');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sangoub_order(uuid,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sangoub_order(uuid,text,jsonb,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_sangoub_delivery(uuid,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sangoub_delivery(uuid,uuid,text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.get_sangoub_order_otp(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sangoub_order_otp(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.pickup_sangoub_order_store(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pickup_sangoub_order_store(uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.depart_sangoub_order(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.depart_sangoub_order(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.claim_sangoub_payment(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sangoub_payment(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finish_sangoub_payment_session(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_sangoub_payment_session(uuid,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_sangoub_payment(uuid,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_sangoub_payment(uuid,text,text,numeric) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='order_fulfillments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_fulfillments;
  END IF;
END $$;

-- === APPLY: scripts/supabase_tracking_rls.sql ===
-- Realtime tracking: Supabase is the source of truth; Firebase is not used here.
-- Run after confirming the live orders, stores, user_roles and courier_locations tables.

DROP POLICY IF EXISTS "Courier location readable by all authenticated" ON public.courier_locations;
DROP POLICY IF EXISTS "Courier can update own location" ON public.courier_locations;
DROP POLICY IF EXISTS "Authorized parties can read courier location" ON public.courier_locations;

CREATE POLICY "Authorized parties can read courier location"
ON public.courier_locations
FOR SELECT
TO authenticated
USING (
  auth.uid() = courier_id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    JOIN public.roles AS r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND lower(COALESCE(r.name_en, r.name_ar, '')) IN ('super admin', 'مدير النظام', 'مدير المنظومة')
  )
  OR EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.courier_id = courier_locations.courier_id
      AND o.status IN ('assigned', 'picked_up', 'with_courier')
      AND (
        o.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.user_roles AS ur
          WHERE ur.user_id = auth.uid()
            AND ur.store_id = o.store_id
        )
      )
  )
);

-- === APPLY: scripts/supabase_merchant_finance_v1.sql ===
-- Merchant settlement read model. Writes are performed by the server after
-- rechecking delivery, payment, contract rate, and duplicate claims.
CREATE TABLE IF NOT EXISTS public.merchant_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  store_name text NOT NULL,
  commission_rate numeric(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  gross numeric(12,2) NOT NULL CHECK (gross >= 0),
  commission numeric(12,2) NOT NULL CHECK (commission >= 0),
  net numeric(12,2) NOT NULL CHECK (net >= 0),
  reference text NOT NULL,
  order_ids uuid[] NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, reference)
);

CREATE TABLE IF NOT EXISTS public.merchant_settlement_claims (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  settlement_id uuid NOT NULL REFERENCES public.merchant_settlements(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, order_id)
);

CREATE INDEX IF NOT EXISTS merchant_settlements_store_created_idx
  ON public.merchant_settlements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_settlement_claims_settlement_idx
  ON public.merchant_settlement_claims(settlement_id);

ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlement_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_settlements, public.merchant_settlement_claims FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_settlements, public.merchant_settlement_claims TO service_role;

CREATE OR REPLACE FUNCTION public.save_sangoub_merchant_settlement(
  p_id uuid,
  p_store_id uuid,
  p_store_name text,
  p_commission_rate numeric,
  p_allocations jsonb,
  p_gross numeric,
  p_commission numeric,
  p_net numeric,
  p_reference text,
  p_order_ids uuid[],
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.merchant_settlements%ROWTYPE;
  v_count integer;
BEGIN
  IF p_id IS NULL OR p_store_id IS NULL OR p_actor_id IS NULL OR p_order_ids IS NULL
     OR cardinality(p_order_ids) < 1 OR cardinality(p_order_ids) > 100
     OR p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array'
     OR NULLIF(btrim(p_reference), '') IS NULL OR length(p_reference) > 200
     OR p_commission_rate < 0 OR p_commission_rate > 100
     OR p_gross < 0 OR p_commission < 0 OR p_net < 0 THEN
    RAISE EXCEPTION 'INVALID_SETTLEMENT_INPUT' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT u.order_id) FROM unnest(p_order_ids) AS u(order_id)) <> cardinality(p_order_ids) THEN
    RAISE EXCEPTION 'INVALID_SETTLEMENT_INPUT' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_record FROM public.merchant_settlements WHERE id=p_id FOR UPDATE;
  IF FOUND THEN
    IF v_record.store_id=p_store_id AND v_record.reference=btrim(p_reference)
       AND v_record.order_ids=p_order_ids AND v_record.gross=p_gross
       AND v_record.commission=p_commission AND v_record.net=p_net THEN
      RETURN to_jsonb(v_record);
    END IF;
    RAISE EXCEPTION 'SETTLEMENT_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.merchant_settlement_claims WHERE store_id=p_store_id AND order_id=ANY(p_order_ids)) THEN
    RAISE EXCEPTION 'SETTLEMENT_ALREADY_CLAIMED' USING ERRCODE = '23505';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.orders o
  WHERE o.id=ANY(p_order_ids) AND o.status='delivered' AND o.payment_status='paid'
    AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id=o.id AND i.store_id=p_store_id);
  IF v_count <> cardinality(p_order_ids) THEN
    RAISE EXCEPTION 'SETTLEMENT_ORDERS_CHANGED' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.merchant_settlements(
    id,store_id,store_name,commission_rate,allocations,gross,commission,net,reference,order_ids,actor_id
  ) VALUES (
    p_id,p_store_id,left(p_store_name,120),p_commission_rate,p_allocations,p_gross,p_commission,p_net,btrim(p_reference),p_order_ids,p_actor_id
  ) RETURNING * INTO v_record;

  INSERT INTO public.merchant_settlement_claims(store_id,order_id,settlement_id)
  SELECT p_store_id,u.order_id,p_id FROM unnest(p_order_ids) AS u(order_id);
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
  VALUES(p_actor_id,'settlement.recorded','merchant_settlements',p_id::text,
    jsonb_build_object('storeId',p_store_id,'reference',btrim(p_reference),'gross',p_gross,'commission',p_commission,'net',p_net),
    'settlements-api');
  RETURN to_jsonb(v_record);
END;
$$;

REVOKE ALL ON FUNCTION public.save_sangoub_merchant_settlement(uuid,uuid,text,numeric,jsonb,numeric,numeric,numeric,text,uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_sangoub_merchant_settlement(uuid,uuid,text,numeric,jsonb,numeric,numeric,numeric,text,uuid[],uuid) TO service_role;

-- === APPLY: scripts/supabase_admin_catalog_v1.sql ===
-- Fields required by authenticated admin edits of the Supabase catalog.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_key text,
  ADD COLUMN IF NOT EXISTS banner_key text,
  ADD COLUMN IF NOT EXISTS image_key text;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

GRANT ALL ON public.stores, public.products, public.coupons TO service_role;

-- === APPLY: scripts/supabase_applications_v1.sql ===
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id text PRIMARY KEY,
  business_name text NOT NULL,
  partner_type text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  branches_count text NOT NULL DEFAULT '1',
  location_in_capital text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','rejected')),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_applications_status_created_idx ON public.partner_applications(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_applications_status_created_idx ON public.job_applications(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.partner_application_limits (
  phone_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_applications,public.job_applications FROM anon,authenticated;
REVOKE ALL ON public.partner_application_limits FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.partner_applications,public.job_applications TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.partner_application_limits TO service_role;

CREATE OR REPLACE FUNCTION public.create_sangoub_partner_application(p_id text,p_payload jsonb,p_phone_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer; v_application public.partner_applications%ROWTYPE;
BEGIN
  IF p_id IS NULL OR length(p_id)>80 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR p_phone_hash !~ '^[a-f0-9]{64}$' OR NULLIF(btrim(p_payload->>'businessName'),'') IS NULL
     OR NULLIF(btrim(p_payload->>'contactName'),'') IS NULL OR NULLIF(btrim(p_payload->>'phone'),'') IS NULL THEN
    RAISE EXCEPTION 'INVALID_PARTNER_APPLICATION' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_application FROM public.partner_applications WHERE id=p_id;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'id',p_id,'duplicate',true); END IF;
  INSERT INTO public.partner_application_limits(phone_hash,window_started_at,request_count)
  VALUES(p_phone_hash,now(),1)
  ON CONFLICT(phone_hash) DO UPDATE SET
    window_started_at=CASE WHEN public.partner_application_limits.window_started_at<now()-interval '24 hours' THEN now() ELSE public.partner_application_limits.window_started_at END,
    request_count=CASE WHEN public.partner_application_limits.window_started_at<now()-interval '24 hours' THEN 1 ELSE public.partner_application_limits.request_count+1 END
  RETURNING request_count INTO v_count;
  IF v_count>5 THEN RAISE EXCEPTION 'PARTNER_APPLICATION_RATE_LIMIT' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.partner_applications(id,business_name,partner_type,contact_name,phone,branches_count,location_in_capital,notes,status)
  VALUES(p_id,left(btrim(p_payload->>'businessName'),120),left(btrim(COALESCE(p_payload->>'partnerType','')),80),
    left(btrim(p_payload->>'contactName'),120),left(btrim(p_payload->>'phone'),30),left(COALESCE(p_payload->>'branchesCount','1'),20),
    left(COALESCE(p_payload->>'locationInCapital',''),240),left(COALESCE(p_payload->>'notes',''),1000),'pending');
  RETURN jsonb_build_object('ok',true,'id',p_id,'duplicate',false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_sangoub_partner_application(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_sangoub_partner_application(text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_sangoub_partner(p_partner_id text,p_store jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_partner public.partner_applications%ROWTYPE; v_store public.stores%ROWTYPE;
BEGIN
  SELECT * INTO v_partner FROM public.partner_applications WHERE id=p_partner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_partner.store_id IS NOT NULL THEN
    SELECT * INTO v_store FROM public.stores WHERE id=v_partner.store_id;
    RETURN jsonb_build_object('ok',true,'storeId',v_partner.store_id,'alreadyApproved',true);
  END IF;
  IF NULLIF(p_store->>'id','') IS NULL OR NULLIF(btrim(p_store->>'name'),'') IS NULL
     OR COALESCE(p_store->>'status','') <> 'closed' THEN
    RAISE EXCEPTION 'INVALID_PARTNER_STORE' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.stores(id,name,name_en,type,category,logo,banner,status,delivery_time,min_order,delivery_fee,location_in_district,commission_rate,tax_rate)
  VALUES ((p_store->>'id')::uuid,left(btrim(p_store->>'name'),120),NULLIF(left(btrim(COALESCE(p_store->>'nameEn',p_store->>'name')),120),''),
    left(COALESCE(p_store->>'type','متجر'),80),COALESCE(NULLIF(p_store->>'category',''),'supermarket'),
    NULLIF(p_store->>'logo',''),NULLIF(p_store->>'banner',''),'closed',COALESCE(NULLIF(p_store->>'deliveryTime',''),'لم يحدد بعد'),
    COALESCE(NULLIF(p_store->>'minOrder','')::numeric,0),COALESCE(NULLIF(p_store->>'deliveryFee','')::numeric,0),
    left(COALESCE(p_store->>'locationInDistrict',v_partner.location_in_capital),240),10,0)
  RETURNING * INTO v_store;
  UPDATE public.partner_applications SET status='approved',store_id=v_store.id,updated_at=now() WHERE id=p_partner_id;
  INSERT INTO public.audit_logs(action,entity_type,entity_id,after_state,source)
    VALUES('partner.approved','partner_applications',p_partner_id,jsonb_build_object('storeId',v_store.id),'admin-data-api');
  RETURN jsonb_build_object('ok',true,'storeId',v_store.id,'alreadyApproved',false);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_sangoub_partner(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_sangoub_partner(text,jsonb) TO service_role;

-- === APPLY: scripts/supabase_admin_orders_v1.sql ===
CREATE OR REPLACE FUNCTION public.admin_update_sangoub_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_order_status text DEFAULT NULL,
  p_courier_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_courier public.profiles%ROWTYPE;
  v_before_status text;
  v_before_courier uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  v_before_status:=v_order.status;
  v_before_courier:=v_order.courier_id;
  IF p_order_status IS NULL AND p_courier_id IS NULL THEN RAISE EXCEPTION 'EMPTY_ORDER_CHANGE' USING ERRCODE='22023'; END IF;
  IF p_order_status IS NOT NULL AND p_order_status <> 'cancelled' THEN RAISE EXCEPTION 'ADMIN_ORDER_STATUS_RESTRICTED' USING ERRCODE='23514'; END IF;
  IF p_order_status='cancelled' AND p_courier_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_ORDER_CHANGE' USING ERRCODE='22023'; END IF;

  IF p_courier_id IS NOT NULL THEN
    IF v_order.status <> 'ready' OR NOT (v_order.payment_method='cash' OR (v_order.payment_status='paid' AND v_order.payment_confirmed_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'ORDER_NOT_READY_FOR_ASSIGNMENT' USING ERRCODE='23514';
    END IF;
    IF v_order.fulfillment_version=2 AND (
      NOT EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id)
      OR EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND (status<>'ready' OR issue_open))
    ) THEN RAISE EXCEPTION 'FULFILLMENT_NOT_READY' USING ERRCODE='23514'; END IF;
    SELECT * INTO v_courier FROM public.profiles WHERE id=p_courier_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'COURIER_PROFILE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    UPDATE public.orders SET courier_id=p_courier_id,courier_name=v_courier.full_name,courier_phone=v_courier.phone,updated_at=now()
      WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  IF p_order_status='cancelled' THEN
    IF v_order.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'ORDER_ALREADY_CLOSED' USING ERRCODE='23514'; END IF;
    IF v_order.payment_method<>'cash' AND v_order.payment_status='paid' THEN RAISE EXCEPTION 'PAID_ORDER_REFUND_REQUIRED' USING ERRCODE='23514'; END IF;
    IF v_order.fulfillment_version=2 THEN
      IF EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND status='picked_up') THEN
        RAISE EXCEPTION 'ORDER_ITEMS_ALREADY_PICKED_UP' USING ERRCODE='23514';
      END IF;
      UPDATE public.order_fulfillments SET status='cancelled',updated_at=now() WHERE order_id=p_order_id AND status<>'cancelled';
    END IF;
    UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
  VALUES(p_actor_id,CASE WHEN p_order_status='cancelled' THEN 'orders.cancelled' ELSE 'orders.courier.assigned' END,
    'orders',p_order_id::text,jsonb_build_object('status',v_before_status,'courier_id',v_before_courier),
    jsonb_build_object('status',v_order.status,'courier_id',v_order.courier_id),'admin-data-api');
  RETURN jsonb_build_object('id',v_order.id,'status',v_order.status,'courier_id',v_order.courier_id,
    'courier_name',v_order.courier_name,'courier_phone',v_order.courier_phone,'updated_at',v_order.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_sangoub_order(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sangoub_order(uuid,uuid,text,uuid) TO service_role;

-- === APPLY: scripts/supabase_admin_rls_v1.sql ===
-- Admin order dashboard access through authenticated Supabase sessions.
DROP POLICY IF EXISTS "Admins read all orders" ON public.orders;
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid()
      AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')
  )
);

-- === APPLY: scripts/supabase_shared_catalog_v1.sql ===
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'غير مصنف',
  image_type text,
  image_url text,
  option_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  origin text NOT NULL DEFAULT 'admin' CHECK(origin IN ('admin','published-product')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.catalog_offers (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  catalog_product_id text NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,catalog_product_id)
);
CREATE INDEX IF NOT EXISTS catalog_products_active_id_idx ON public.catalog_products(id) WHERE active;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_products,public.catalog_offers FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.catalog_products,public.catalog_offers TO service_role;

CREATE OR REPLACE FUNCTION public.publish_sangoub_catalog_product(p_product_id text,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_product public.products%ROWTYPE; v_catalog_id text;
BEGIN
  IF p_product_id !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id::uuid FOR UPDATE;
  IF NOT FOUND OR v_product.archived THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  v_catalog_id:=COALESCE(NULLIF(v_product.catalog_product_id,''),p_product_id);
  IF NOT EXISTS(SELECT 1 FROM public.catalog_products WHERE id=v_catalog_id) THEN
    INSERT INTO public.catalog_products(id,name,description,category,image_type,image_url,option_groups,active,created_by)
    VALUES(v_catalog_id,left(btrim(v_product.name),120),left(COALESCE(v_product.description,''),1000),left(COALESCE(NULLIF(btrim(v_product.category),''),'غير مصنف'),120),v_product.image_type,v_product.image_url,COALESCE(v_product.options,'[]'::jsonb),true,p_actor_id);
  END IF;
  UPDATE public.products SET catalog_product_id=v_catalog_id,updated_at=now() WHERE id=v_product.id;
  INSERT INTO public.catalog_offers(store_id,catalog_product_id,product_id) VALUES(v_product.store_id,v_catalog_id,v_product.id)
  ON CONFLICT(store_id,catalog_product_id) DO NOTHING;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
  VALUES(p_actor_id,'catalog.publish','catalog_products',v_catalog_id,jsonb_build_object('sourceProductId',v_product.id),'admin-data-api');
  RETURN jsonb_build_object('ok',true,'catalogProductId',v_catalog_id);
END $$;
REVOKE ALL ON FUNCTION public.publish_sangoub_catalog_product(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_sangoub_catalog_product(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.link_sangoub_catalog_product(p_store_id uuid,p_catalog_product_id text,p_price numeric,p_existing_product_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_catalog public.catalog_products%ROWTYPE; v_source public.products%ROWTYPE; v_link public.catalog_offers%ROWTYPE; v_product public.products%ROWTYPE;
BEGIN
  IF p_store_id IS NULL OR p_catalog_product_id IS NULL OR p_price<0 OR p_price>100000 OR p_actor_id IS NULL THEN RAISE EXCEPTION 'INVALID_CATALOG_INPUT' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.stores WHERE id=p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_catalog FROM public.catalog_products WHERE id=p_catalog_product_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_catalog_product_id !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    SELECT * INTO v_source FROM public.products WHERE id=p_catalog_product_id::uuid AND is_available AND NOT archived AND NULLIF(catalog_product_id,'') IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    INSERT INTO public.catalog_products(id,name,description,category,image_type,image_url,option_groups,active,origin,created_by)
    VALUES(v_source.id::text,left(btrim(v_source.name),120),left(COALESCE(v_source.description,''),1000),left(COALESCE(NULLIF(btrim(v_source.category),''),'غير مصنف'),120),v_source.image_type,v_source.image_url,COALESCE(v_source.options,'[]'::jsonb),true,'published-product',p_actor_id)
    RETURNING * INTO v_catalog;
    UPDATE public.products SET catalog_product_id=v_catalog.id,updated_at=now() WHERE id=v_source.id;
    IF v_source.store_id IS NOT NULL THEN
      INSERT INTO public.catalog_offers(store_id,catalog_product_id,product_id) VALUES(v_source.store_id,v_catalog.id,v_source.id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  IF NOT v_catalog.active THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_link FROM public.catalog_offers WHERE store_id=p_store_id AND catalog_product_id=p_catalog_product_id;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'id',v_link.product_id,'alreadyLinked',true); END IF;
  IF p_existing_product_id IS NOT NULL THEN
    SELECT * INTO v_product FROM public.products WHERE id=p_existing_product_id AND store_id=p_store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_OWNED' USING ERRCODE='42501'; END IF;
    IF NULLIF(v_product.catalog_product_id,'') IS NOT NULL AND v_product.catalog_product_id<>p_catalog_product_id THEN RAISE EXCEPTION 'PRODUCT_NOT_OWNED' USING ERRCODE='42501'; END IF;
    UPDATE public.products SET name=v_catalog.name,description=v_catalog.description,category=v_catalog.category,image_type=v_catalog.image_type,image_url=v_catalog.image_url,options=v_catalog.option_groups,catalog_product_id=p_catalog_product_id,updated_at=now()
      WHERE id=v_product.id RETURNING * INTO v_product;
  ELSE
    INSERT INTO public.products(store_id,name,description,price,category,image_type,image_url,options,is_available,archived,catalog_product_id)
    VALUES(p_store_id,v_catalog.name,v_catalog.description,p_price,v_catalog.category,v_catalog.image_type,v_catalog.image_url,v_catalog.option_groups,false,false,p_catalog_product_id)
    RETURNING * INTO v_product;
  END IF;
  INSERT INTO public.catalog_offers(store_id,catalog_product_id,product_id) VALUES(p_store_id,p_catalog_product_id,v_product.id);
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
  VALUES(p_actor_id,'merchant.catalog-link','products',v_product.id::text,jsonb_build_object('storeId',p_store_id,'catalogProductId',p_catalog_product_id),'operations-api');
  RETURN jsonb_build_object('ok',true,'id',v_product.id,'alreadyLinked',false);
END $$;
REVOKE ALL ON FUNCTION public.link_sangoub_catalog_product(uuid,text,numeric,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_sangoub_catalog_product(uuid,text,numeric,uuid,uuid) TO service_role;

-- === APPLY: scripts/supabase_operations_v1.sql ===
CREATE OR REPLACE FUNCTION public.cancel_sangoub_order(p_order_id uuid,p_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND customer_id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_order.status='cancelled' THEN RETURN jsonb_build_object('ok',true,'alreadyCancelled',true); END IF;
  IF v_order.status<>'received' OR (v_order.payment_method<>'cash' AND v_order.payment_status='paid')
    OR EXISTS(SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND status<>'received') THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED' USING ERRCODE='23514';
  END IF;
  UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p_order_id;
  UPDATE public.order_fulfillments SET status='cancelled',updated_at=now() WHERE order_id=p_order_id AND status='received';
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
    VALUES(p_customer_id,'orders.cancelled','orders',p_order_id::text,jsonb_build_object('status',v_order.status),jsonb_build_object('status','cancelled'),'operations-api');
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.cancel_sangoub_order(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sangoub_order(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.update_sangoub_fulfillment(
 p_order_id uuid,p_store_id uuid,p_actor_id uuid,p_action text,p_next text DEFAULT NULL,p_checked_item_ids jsonb DEFAULT '[]'::jsonb,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_ticket public.order_fulfillments%ROWTYPE; v_all_ready boolean; v_expected_count integer; v_checked_count integer;
BEGIN
  IF p_action NOT IN ('prepare','report-issue','resolve-issue') THEN RAISE EXCEPTION 'INVALID_FULFILLMENT_ACTION' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_ticket FROM public.order_fulfillments WHERE order_id=p_order_id AND store_id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FULFILLMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_action='resolve-issue' THEN
    IF NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
    IF length(btrim(COALESCE(p_reason,'')))<5 OR length(p_reason)>500 THEN RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE='22023'; END IF;
    UPDATE public.order_fulfillments SET issue_open=false,resolution=btrim(p_reason),updated_at=now() WHERE order_id=p_order_id AND store_id=p_store_id;
    INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source) VALUES(p_actor_id,'fulfillment.issue.resolved','orders',p_order_id::text,jsonb_build_object('storeId',p_store_id,'reason',btrim(p_reason)),'operations-api');
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND ur.store_id=p_store_id AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('store owner','store manager','kitchen & prep staff','مالك المتجر','مدير المتجر','طاقم المطبخ والتحضير'))
     AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')) THEN RAISE EXCEPTION 'STORE_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_action='report-issue' THEN
    IF length(btrim(COALESCE(p_reason,'')))<5 OR length(p_reason)>500 OR v_ticket.status='picked_up' THEN RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE='22023'; END IF;
    UPDATE public.order_fulfillments SET issue=btrim(p_reason),issue_open=true,updated_at=now() WHERE order_id=p_order_id AND store_id=p_store_id;
    INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source) VALUES(p_actor_id,'fulfillment.issue','orders',p_order_id::text,jsonb_build_object('storeId',p_store_id,'reason',btrim(p_reason)),'operations-api');
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF p_next NOT IN ('preparing','ready') OR v_ticket.issue_open OR v_ticket.status='picked_up'
    OR NOT (v_order.payment_method='cash' OR (v_order.payment_status='paid' AND v_order.payment_confirmed_at IS NOT NULL)) THEN RAISE EXCEPTION 'FULFILLMENT_NOT_READY' USING ERRCODE='23514'; END IF;
  IF p_next='preparing' AND v_ticket.status<>'received' OR p_next='ready' AND v_ticket.status<>'preparing' THEN
    IF v_ticket.status=p_next THEN RETURN jsonb_build_object('ok',true,'alreadyApplied',true); END IF;
    RAISE EXCEPTION 'FULFILLMENT_STALE' USING ERRCODE='40001';
  END IF;
  IF p_next='ready' THEN
    SELECT count(*) INTO v_expected_count FROM jsonb_array_elements(v_ticket.items);
    SELECT count(DISTINCT value) INTO v_checked_count FROM jsonb_array_elements_text(p_checked_item_ids);
    IF jsonb_typeof(p_checked_item_ids)<>'array' OR v_expected_count<>v_checked_count OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_ticket.items) WITH ORDINALITY item(value,idx)
      WHERE NOT (p_checked_item_ids ? COALESCE(item.value->>'id',(item.idx-1)::text))
    ) THEN RAISE EXCEPTION 'ITEM_CHECKLIST_REQUIRED' USING ERRCODE='22023'; END IF;
  END IF;
  UPDATE public.order_fulfillments SET status=p_next,checked_item_ids=CASE WHEN p_next='ready' THEN p_checked_item_ids ELSE '[]'::jsonb END,prepared_by=p_actor_id,ready_at=CASE WHEN p_next='ready' THEN now() ELSE ready_at END,updated_at=now()
    WHERE order_id=p_order_id AND store_id=p_store_id;
  SELECT bool_and(status IN ('ready','picked_up')) INTO v_all_ready FROM public.order_fulfillments WHERE order_id=p_order_id;
  UPDATE public.orders SET status=CASE WHEN p_next='ready' AND v_all_ready THEN 'ready' ELSE 'preparing' END,ready_at=CASE WHEN p_next='ready' AND v_all_ready THEN now() ELSE ready_at END,updated_at=now() WHERE id=p_order_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source) VALUES(p_actor_id,'fulfillment.'||p_next,'orders',p_order_id::text,jsonb_build_object('storeId',p_store_id,'status',p_next),'operations-api');
  RETURN jsonb_build_object('ok',true,'orderStatus',CASE WHEN p_next='ready' AND v_all_ready THEN 'ready' ELSE 'preparing' END);
END $$;
REVOKE ALL ON FUNCTION public.update_sangoub_fulfillment(uuid,uuid,uuid,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_sangoub_fulfillment(uuid,uuid,uuid,text,text,jsonb,text) TO service_role;

-- === APPLY: scripts/supabase_analytics_v1.sql ===
CREATE TABLE IF NOT EXISTS public.site_visitors (
  visitor_hash text PRIMARY KEY CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  last_day date NOT NULL,
  source text NOT NULL DEFAULT 'direct',
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.site_visitor_days (
  day date PRIMARY KEY,
  visitors bigint NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  events jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.site_visitor_totals (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  visitors bigint NOT NULL DEFAULT 0,
  started_at timestamptz,
  analytics_started_at timestamptz
);
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_visitors, public.site_visitor_days, public.site_visitor_totals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_visitors, public.site_visitor_days, public.site_visitor_totals TO service_role;

CREATE OR REPLACE FUNCTION public.record_sangoub_site_visit(p_hash text,p_day date,p_source text,p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.site_visitors%ROWTYPE; v_exists boolean; v_same boolean; v_new_source boolean; v_new_event boolean; v_new_visitor boolean;
BEGIN
  IF p_hash !~ '^[a-f0-9]{64}$' OR p_source NOT IN ('facebook','whatsapp','instagram','search','other','direct')
    OR (p_event IS NOT NULL AND p_event NOT IN ('mascot_open','breakfast','supermarket','review_breakfast','review_supermarket','whatsapp_breakfast','whatsapp_supermarket','whatsapp_support')) THEN
    RAISE EXCEPTION 'INVALID_SITE_VISIT' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.site_visitor_totals(id,visitors,started_at,analytics_started_at)
  VALUES(true,0,now(),now()) ON CONFLICT(id) DO NOTHING;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_hash,0));
  SELECT * INTO v_old FROM public.site_visitors WHERE visitor_hash=p_hash FOR UPDATE;
  v_exists := FOUND;
  v_new_visitor := NOT v_exists;
  v_same := v_exists AND v_old.last_day=p_day;
  v_new_source := NOT v_same OR NULLIF(v_old.source,'') IS NULL;
  v_new_event := p_event IS NOT NULL AND (NOT v_same OR NOT (v_old.events ? p_event));
  IF NOT v_same OR v_new_source OR v_new_event THEN
    INSERT INTO public.site_visitors(visitor_hash,last_day,source,events)
    VALUES(p_hash,p_day,p_source,CASE WHEN p_event IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p_event) END)
    ON CONFLICT(visitor_hash) DO UPDATE SET last_day=EXCLUDED.last_day,
      source=CASE WHEN v_new_source THEN p_source ELSE public.site_visitors.source END,
      events=CASE WHEN v_same AND p_event IS NOT NULL AND v_new_event THEN public.site_visitors.events || jsonb_build_array(p_event)
        WHEN NOT v_same AND p_event IS NOT NULL THEN jsonb_build_array(p_event)
        WHEN NOT v_same THEN '[]'::jsonb ELSE public.site_visitors.events END;
    INSERT INTO public.site_visitor_days(day,visitors,sources,events)
    VALUES(p_day,CASE WHEN v_same THEN 0 ELSE 1 END,
      CASE WHEN v_new_source THEN jsonb_build_object(p_source,1) ELSE '{}'::jsonb END,
      CASE WHEN v_new_event THEN jsonb_build_object(p_event,1) ELSE '{}'::jsonb END)
    ON CONFLICT(day) DO UPDATE SET
      visitors=public.site_visitor_days.visitors+EXCLUDED.visitors,
      sources=CASE WHEN v_new_source THEN jsonb_set(public.site_visitor_days.sources,ARRAY[p_source],to_jsonb(COALESCE((public.site_visitor_days.sources->>p_source)::bigint,0)+1),true) ELSE public.site_visitor_days.sources END,
      events=CASE WHEN v_new_event THEN jsonb_set(public.site_visitor_days.events,ARRAY[p_event],to_jsonb(COALESCE((public.site_visitor_days.events->>p_event)::bigint,0)+1),true) ELSE public.site_visitor_days.events END;
  END IF;
  IF v_new_visitor THEN UPDATE public.site_visitor_totals SET visitors=visitors+1 WHERE id=true; END IF;
  UPDATE public.site_visitor_totals SET analytics_started_at=COALESCE(analytics_started_at,now()),started_at=COALESCE(started_at,now()) WHERE id=true;
END $$;
REVOKE ALL ON FUNCTION public.record_sangoub_site_visit(text,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_sangoub_site_visit(text,date,text,text) TO service_role;

-- === APPLY: scripts/supabase_requests_v1.sql ===
CREATE TABLE IF NOT EXISTS public.sangoub_requests (
  id text PRIMARY KEY CHECK (id ~ '^SNG-[a-f0-9-]{36}$'),
  kind text NOT NULL CHECK (kind IN ('breakfast','supermarket')),
  name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  office text NOT NULL,
  notes text NOT NULL DEFAULT '',
  payment text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_quantity integer NOT NULL CHECK (total_quantity >= 0),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','completed','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  admin_note text,
  source text NOT NULL DEFAULT 'sangoub-web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sangoub_requests_created_idx ON public.sangoub_requests(created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS public.sangoub_request_limits (
  phone_hash text PRIMARY KEY CHECK (phone_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK(request_count>=0)
);
ALTER TABLE public.sangoub_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sangoub_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sangoub_requests,public.sangoub_request_limits FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sangoub_requests,public.sangoub_request_limits TO service_role;

CREATE OR REPLACE FUNCTION public.create_sangoub_request(p_id text,p_kind text,p_data jsonb,p_fingerprint text,p_phone_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_existing public.sangoub_requests%ROWTYPE; v_count integer; v_recent boolean;
BEGIN
  IF p_id !~ '^SNG-[a-f0-9-]{36}$' OR p_kind NOT IN ('breakfast','supermarket') OR jsonb_typeof(p_data)<>'object'
    OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_phone_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_SANGOUB_REQUEST' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id,0));
  SELECT * INTO v_existing FROM public.sangoub_requests WHERE id=p_id;
  IF FOUND THEN
    IF v_existing.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'SANGOUB_REQUEST_CONFLICT' USING ERRCODE='23505'; END IF;
    RETURN jsonb_build_object('id',p_id,'duplicate',true);
  END IF;
  INSERT INTO public.sangoub_request_limits(phone_hash,window_started_at,request_count) VALUES(p_phone_hash,now(),1)
  ON CONFLICT(phone_hash) DO UPDATE SET
    window_started_at=CASE WHEN public.sangoub_request_limits.window_started_at<now()-interval '24 hours' THEN now() ELSE public.sangoub_request_limits.window_started_at END,
    request_count=CASE WHEN public.sangoub_request_limits.window_started_at<now()-interval '24 hours' THEN 1 ELSE public.sangoub_request_limits.request_count+1 END
  RETURNING request_count INTO v_count;
  IF v_count>10 THEN RAISE EXCEPTION 'SANGOUB_REQUEST_RATE_LIMIT' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.sangoub_requests(id,kind,name,phone,address,office,notes,payment,items,total_quantity,fingerprint)
  VALUES(p_id,p_kind,left(btrim(p_data->>'name'),120),left(btrim(p_data->>'phone'),30),left(btrim(p_data->>'address'),500),
    left(btrim(p_data->>'office'),120),left(btrim(p_data->>'notes'),500),left(btrim(p_data->>'payment'),40),
    COALESCE(p_data->'items','[]'::jsonb),COALESCE((p_data->>'totalQuantity')::integer,0),p_fingerprint);
  RETURN jsonb_build_object('id',p_id,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.create_sangoub_request(text,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_sangoub_request(text,text,jsonb,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_sangoub_request(p_id text,p_actor_id uuid,p_expected_status text,p_expected_version integer,p_status text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.sangoub_requests%ROWTYPE; v_after public.sangoub_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM public.sangoub_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SANGOUB_REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_before.status<>p_expected_status OR v_before.version<>p_expected_version THEN RAISE EXCEPTION 'SANGOUB_REQUEST_STALE' USING ERRCODE='40001'; END IF;
  IF p_status NOT IN ('new','contacted','completed','cancelled') OR length(btrim(p_note))=0 OR length(p_note)>500 THEN RAISE EXCEPTION 'INVALID_SANGOUB_REQUEST_UPDATE' USING ERRCODE='22023'; END IF;
  UPDATE public.sangoub_requests SET status=p_status,version=version+1,admin_note=btrim(p_note),updated_at=now() WHERE id=p_id RETURNING * INTO v_after;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,reason,source)
  VALUES(p_actor_id,'sangoub.followup','sangoub_requests',p_id,jsonb_build_object('status',v_before.status),
    jsonb_build_object('status',v_after.status,'note',v_after.admin_note),'','admin-data-api');
  RETURN jsonb_build_object('ok',true,'version',v_after.version);
END $$;
REVOKE ALL ON FUNCTION public.admin_update_sangoub_request(text,uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sangoub_request(text,uuid,text,integer,text,text) TO service_role;

-- === APPLY: scripts/supabase_app_content_v1.sql ===
CREATE TABLE IF NOT EXISTS public.app_content (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_content FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_content TO service_role;

