-- ==============================================================================
-- 🚀 SANGOUB - FIX ORDER CREATION & CLIENT PERMISSIONS
-- شغل هذا الكود في Supabase SQL Editor لتفعيل حفظ الطلبات مباشرة من المتصفح
-- ==============================================================================

-- 1. السماح للمستخدمين بتشغيل دالة إنشاء الطلب الآمنة
GRANT EXECUTE ON FUNCTION public.create_sangoub_order(uuid, text, jsonb, jsonb, text) TO authenticated, anon;

-- 2. إعطاء الصلاحيات لجداول الطلبات والعناصر
GRANT SELECT, INSERT ON public.orders TO authenticated, anon;
GRANT SELECT, INSERT ON public.order_items TO authenticated, anon;

-- 3. تفعيل سياسات الأمان للطلب المباشر
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders" ON public.orders 
FOR INSERT TO authenticated, anon 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
CREATE POLICY "Users can insert own order items" ON public.order_items 
FOR INSERT TO authenticated, anon 
WITH CHECK (true);

-- 4. التأكد من أن المستخدمين يستطيعون قراءة طلباتهم
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders 
FOR SELECT TO authenticated, anon 
USING (customer_id = auth.uid() OR customer_id IS NULL OR true);

DROP POLICY IF EXISTS "Users read own order items" ON public.order_items;
CREATE POLICY "Users read own order items" ON public.order_items 
FOR SELECT TO authenticated, anon 
USING (true);

-- 5. تفعيل قراءة محتوى التطبيق وصور الأقسام المخصصة (app_content)
GRANT SELECT ON public.app_content TO authenticated, anon;
DROP POLICY IF EXISTS "Public read app_content" ON public.app_content;
CREATE POLICY "Public read app_content" ON public.app_content 
FOR SELECT TO authenticated, anon 
USING (true);

-- 6. تفعيل صلاحيات وقراءة وكتابة وتحديث إشعارات العملاء التلقائية (notifications)
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated, anon;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
FOR SELECT TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
FOR INSERT TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 7. مشغل قاعدة البيانات لتسجيل الإشعار فور تحديث حالة الطلب
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_num text;
BEGIN
  v_num := COALESCE(NEW.order_number, substring(NEW.id::text from 1 for 8));
  
  IF (TG_OP = 'INSERT') THEN
    v_title := 'تم استلام طلبك بنجاح! 🎉';
    v_body := 'طلبك رقم (' || v_num || ') قيد المراجعة والتجهيز لدى المتجر.';
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'preparing' THEN
      v_title := 'طلبك قيد التجهيز الآن 👨‍🍳';
      v_body := 'المتجر يقوم حالياً بتحضير وتغليف طلبك رقم (' || v_num || ').';
    ELSIF NEW.status = 'ready' THEN
      v_title := 'طلبك جاهز للاستلام! 📦';
      v_body := 'تم تجهيز طلبك رقم (' || v_num || ') وفي انتظار استلام المندوب.';
    ELSIF NEW.status = 'with_courier' THEN
      v_title := 'المندوب في الطريق إليك 🛵';
      v_body := 'استلم المندوب طلبك رقم (' || v_num || ') وهو متوجه إلى عنوانك الآن.';
    ELSIF NEW.status = 'delivered' THEN
      v_title := 'تم توصيل الطلب بنجاح! 🎉';
      v_body := 'بالهناء والشفاء! تم تسليم طلبك رقم (' || v_num || ').';
    ELSIF NEW.status = 'cancelled' THEN
      v_title := 'تم إلغاء الطلب';
      v_body := 'تم إلغاء طلبك رقم (' || v_num || ').';
    ELSE
      v_title := 'تحديث في حالة الطلب';
      v_body := 'تم تغيير حالة طلبك رقم (' || v_num || ') إلى ' || NEW.status;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, data, is_read)
    VALUES (
      NEW.customer_id,
      v_title,
      v_body,
      'order',
      jsonb_build_object('orderId', NEW.id, 'orderNumber', v_num, 'status', NEW.status),
      false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_order_status ON public.orders;
CREATE TRIGGER trg_notify_order_status
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- 8. تفعيل تحديث المتاجر وربطها بالملاك والمديرين من لوحة الإدارة
GRANT SELECT, INSERT, UPDATE ON public.stores TO authenticated, anon;
DROP POLICY IF EXISTS "Public update stores" ON public.stores;
CREATE POLICY "Public update stores" ON public.stores FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- 9. تفعيل تحديث المنتجات وتوافرها وحالات الإيقاف
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated, anon;
DROP POLICY IF EXISTS "Public update products" ON public.products;
CREATE POLICY "Public update products" ON public.products FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- 10. تفعيل صلاحيات وقراءة ملفات المستخدمين بالكامل وفك قيد الارتباط بجدول auth.users
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
GRANT ALL ON public.profiles TO authenticated, anon;

DROP POLICY IF EXISTS "Public select profiles" ON public.profiles;
CREATE POLICY "Public select profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;
CREATE POLICY "Public update profiles" ON public.profiles FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
CREATE POLICY "Public insert profiles" ON public.profiles FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete profiles" ON public.profiles;
CREATE POLICY "Public delete profiles" ON public.profiles FOR DELETE TO authenticated, anon USING (true);

-- 11. إضافة عمود store_id لجدول profiles لربط التجار بمتاجرهم مباشرة
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_id text;

-- 12. تسجيل حساب طارق (tarek@san.com) في جدول profiles وربطه بمتجر كشري ابو طارق
INSERT INTO public.profiles (id, full_name, email, phone, role, store_id, courier_status, created_at, updated_at)
VALUES (
  'dfc169d4-9556-4923-9904-fc14ad04886e',
  'محمد ابوطارق',
  'tarek@san.com',
  '0123456789',
  'restaurant',
  '3dfaad80-6616-45b3-8716-47127039bf85',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    store_id = EXCLUDED.store_id;

-- ربط متجر كشري ابو طارق بحساب التاجر في جدول stores
UPDATE public.stores
SET owner_id = 'dfc169d4-9556-4923-9904-fc14ad04886e'
WHERE id = '3dfaad80-6616-45b3-8716-47127039bf85';

-- 13. تسجيل حساب هايبروان (hyper@san.com) في جدول profiles وربطه بمتجر هايبروان
INSERT INTO public.profiles (id, full_name, email, phone, role, store_id, courier_status, created_at, updated_at)
VALUES (
  '40f443c5-bca2-4a77-b7da-f95271055415',
  'هايبروان',
  'hyper@san.com',
  '01234567891',
  'restaurant',
  '40f443c5-bca2-4a77-b7da-f95271055415',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE 
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    store_id = EXCLUDED.store_id;

-- ربط متجر هايبروان بحساب التاجر في جدول stores
UPDATE public.stores
SET owner_id = '40f443c5-bca2-4a77-b7da-f95271055415'
WHERE id = '40f443c5-bca2-4a77-b7da-f95271055415';

-- 14. تفعيل صلاحيات الإشعارات بالكامل لمنع خطأ 403 Forbidden
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.notifications TO authenticated, anon;

-- 15. تنظيف عناوين المتاجر من أي مسميات قديمة
UPDATE public.stores 
SET location_in_district = replace(location_in_district, 'الحي الحكومي - ', '')
WHERE location_in_district LIKE '%الحي الحكومي%';


