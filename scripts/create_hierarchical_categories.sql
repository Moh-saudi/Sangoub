-- ==============================================================================
-- 🚀 SANGOUB HIERARCHICAL CATEGORY TAXONOMY
-- شجرة التصنيفات الهرمية متعددة المستويات (رئيسي > فرعي > تحت فرعي)
-- Project Ref: tvnsqatkaqyubeznhnmu
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vertical_id TEXT REFERENCES public.catalog_verticals(id) ON DELETE RESTRICT DEFAULT 'supermarket',
    parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    slug TEXT NOT NULL,
    icon TEXT DEFAULT 'folder',
    image_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- الفهارس لتسريع التصفح والبحث الشجري
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_vertical ON public.categories(vertical_id);
CREATE INDEX IF NOT EXISTS idx_categories_active_order ON public.categories(is_active, display_order);

-- إضافة عمود category_id إلى جدول المنتجات الحالي وجدول master_spu إن لم يكن موجوداً
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category_id') THEN
        ALTER TABLE public.products ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_spu' AND column_name = 'category_id') THEN
        ALTER TABLE public.master_spu ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- تفعيل سياسات الأمان RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories viewable by everyone" ON public.categories;
CREATE POLICY "Categories viewable by everyone" ON public.categories
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Categories manageable by admins" ON public.categories;
CREATE POLICY "Categories manageable by admins" ON public.categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- زرع شجرة تصنيفات نموذجية شاملة (Supermarket + Restaurant + Pharmacy)
DO $$
DECLARE
    -- معرفات أقسام السوبرماركت الرئيسية
    v_dairy_id UUID := gen_random_uuid();
    v_pantry_id UUID := gen_random_uuid();
    v_beverages_id UUID := gen_random_uuid();
    v_snacks_id UUID := gen_random_uuid();

    -- معرفات أقسام المطاعم الرئيسية
    v_meals_id UUID := gen_random_uuid();
    v_breakfast_id UUID := gen_random_uuid();
    v_appetizers_id UUID := gen_random_uuid();
    v_desserts_id UUID := gen_random_uuid();

    -- أقسام فرعية
    v_white_cheese UUID := gen_random_uuid();
    v_oils UUID := gen_random_uuid();
    v_burger UUID := gen_random_uuid();
BEGIN
    -- تنظيف التجريبي السابق للتصنيفات لضمان نقاء الشجرة
    DELETE FROM public.categories WHERE slug LIKE 'seed-%';

    -- 🛒 1. أقسام السوبرماركت الرئيسية
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES 
        (v_dairy_id, 'supermarket', NULL, 'ألبان وأجبان وبيض', 'Dairy & Eggs', 'seed-dairy', 'milk', 1),
        (v_pantry_id, 'supermarket', NULL, 'مؤن وبقالة أساسية', 'Pantry & Staples', 'seed-pantry', 'shopping-basket', 2),
        (v_beverages_id, 'supermarket', NULL, 'مشروبات ومياه', 'Beverages & Water', 'seed-beverages', 'coffee', 3),
        (v_snacks_id, 'supermarket', NULL, 'شيبس وسناكس وحلويات', 'Snacks & Sweets', 'seed-snacks', 'cookie', 4)
    ON CONFLICT (id) DO NOTHING;

    -- أقسام فرعية للسوبرماركت (المستوى الثاني)
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_white_cheese, 'supermarket', v_dairy_id, 'أجبان بيضاء وقريش', 'White Cheese', 'seed-white-cheese', 'cheese', 1),
        (gen_random_uuid(), 'supermarket', v_dairy_id, 'أجبان صفراء ومطبوخة', 'Yellow & Processed Cheese', 'seed-yellow-cheese', 'cheese', 2),
        (gen_random_uuid(), 'supermarket', v_dairy_id, 'حليب ولبن رائب', 'Fresh Milk & Laban', 'seed-milk', 'cup-soda', 3),
        (v_oils, 'supermarket', v_pantry_id, 'زيوت طعام وسمن', 'Cooking Oils & Ghee', 'seed-oils', 'flame', 1),
        (gen_random_uuid(), 'supermarket', v_pantry_id, 'أرز ومكرونة وبقوليات', 'Rice, Pasta & Grains', 'seed-grains', 'wheat', 2),
        (gen_random_uuid(), 'supermarket', v_pantry_id, 'تونا ومعلبات وصلصة', 'Canned Goods & Tuna', 'seed-canned', 'archive', 3),
        (gen_random_uuid(), 'supermarket', v_beverages_id, 'مياه معدنية وفوارة', 'Mineral Water', 'seed-water', 'droplet', 1),
        (gen_random_uuid(), 'supermarket', v_beverages_id, 'مشروبات غازية', 'Soft Drinks', 'seed-soft-drinks', 'sparkles', 2),
        (gen_random_uuid(), 'supermarket', v_beverages_id, 'عصائر طبيعية ومشروبات', 'Packaged Juices', 'seed-juices', 'citrus', 3),
        (gen_random_uuid(), 'supermarket', v_snacks_id, 'شيبس ومقرمشات وبسكويت', 'Chips & Crackers', 'seed-chips', 'cookie', 1),
        (gen_random_uuid(), 'supermarket', v_snacks_id, 'شوكولاتة وحلويات', 'Chocolates & Candy', 'seed-candy', 'candy', 2)
    ON CONFLICT (id) DO NOTHING;

    -- أقسام المستوى الثالث (Sub-sub categories)
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (gen_random_uuid(), 'supermarket', v_white_cheese, 'جبن فيتا وإسطنبولي براميلي', 'Feta & Istanboully', 'seed-feta', 'tag', 1),
        (gen_random_uuid(), 'supermarket', v_white_cheese, 'جبن قريش طبيعي وخالي دسم', 'Cottage Cheese', 'seed-cottage', 'tag', 2),
        (gen_random_uuid(), 'supermarket', v_oils, 'زيت عباد الشمس وذرة', 'Sunflower & Corn Oil', 'seed-corn-oil', 'tag', 1),
        (gen_random_uuid(), 'supermarket', v_oils, 'زيت زيتون بكر ممتاز', 'Extra Virgin Olive Oil', 'seed-olive-oil', 'tag', 2)
    ON CONFLICT (id) DO NOTHING;

    -- 🍔 2. أقسام المطاعم الرئيسية والفرعية
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_meals_id, 'restaurant', NULL, 'وجبات وساندوتشات رئيسية', 'Main Meals & Sandwiches', 'seed-rest-meals', 'utensils', 1),
        (v_breakfast_id, 'restaurant', NULL, 'فطور ومخبوزات شرقية', 'Breakfast & Bakery', 'seed-rest-breakfast', 'croissant', 2),
        (v_appetizers_id, 'restaurant', NULL, 'مقبلات وسلطات وصوصات', 'Sides & Salads', 'seed-rest-sides', 'salad', 3),
        (v_desserts_id, 'restaurant', NULL, 'حلويات ومشروبات فريش', 'Desserts & Fresh Drinks', 'seed-rest-desserts', 'cake', 4)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_burger, 'restaurant', v_meals_id, 'ساندوتشات برجر ولحم', 'Burgers & Beef', 'seed-burgers', 'sandwich', 1),
        (gen_random_uuid(), 'restaurant', v_meals_id, 'شاورما ودجاج مشوي', 'Shawarma & Chicken', 'seed-shawarma', 'utensils-crossed', 2),
        (gen_random_uuid(), 'restaurant', v_meals_id, 'بيتزا وفطائر إيطالية', 'Pizza & Pies', 'seed-pizza', 'pizza', 3),
        (gen_random_uuid(), 'restaurant', v_breakfast_id, 'فول وفلافل وطعمية', 'Foul & Falafel', 'seed-foul', 'cooking-pot', 1),
        (gen_random_uuid(), 'restaurant', v_breakfast_id, 'فطير مشلتت ومعجنات', 'Feteer & Pastries', 'seed-feteer', 'cake-slice', 2),
        (gen_random_uuid(), 'restaurant', v_appetizers_id, 'بطاطس مقلية وصوصات مميزة', 'Fries & Specialty Sauces', 'seed-fries', 'flame', 1),
        (gen_random_uuid(), 'restaurant', v_desserts_id, 'عصائر طازجة وكوكتيل', 'Fresh Juices & Smoothies', 'seed-fresh-juice', 'glass-water', 1)
    ON CONFLICT (id) DO NOTHING;

END $$;

