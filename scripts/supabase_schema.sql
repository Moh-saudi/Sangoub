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

-- 9. تفعيل التحديث التلقائي اللحظي (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 10. تفعيل سياسات الأمان (Row Level Security - RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- سياسات عامة للقراءة
CREATE POLICY "Profiles readable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Stores viewable by everyone" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Store owners can update their store" ON public.stores FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Products viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Store owners can manage products" ON public.products FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = products.store_id AND stores.owner_id = auth.uid()));

CREATE POLICY "Users can view relevant orders" ON public.orders FOR SELECT TO authenticated 
  USING (customer_id = auth.uid() OR courier_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.stores WHERE stores.id = orders.store_id AND stores.owner_id = auth.uid()
  ));

CREATE POLICY "Users can insert orders" ON public.orders FOR INSERT TO authenticated 
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Order items viewable with order" ON public.order_items FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id));

CREATE POLICY "Courier location readable by all authenticated" ON public.courier_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Courier can update own location" ON public.courier_locations FOR ALL TO authenticated USING (auth.uid() = courier_id);

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

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
    COALESCE(new.raw_user_meta_data->>'role', 'employee')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- مشغل الدالة (Trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

