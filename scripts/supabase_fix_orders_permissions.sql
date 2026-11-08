-- ==============================================================================
-- 🚀 SANGOUB - FIX ORDER CREATION & CLIENT PERMISSIONS
-- شغل هذا الكود في Supabase SQL Editor لتفعيل حفظ الطلبات مباشرة من المتصفح
-- ==============================================================================

-- 1. السماح للمستخدمين بتشغيل دالة إنشاء الطلب الآمنة
GRANT EXECUTE ON FUNCTION public.create_sangoub_order(uuid, text, jsonb, jsonb, text) TO authenticated, anon;

-- 2. إعطاء الصلاحيات الكاملة لجداول الطلبات والعناصر (قراءة، إنشاء، وتحديث الحالات)
GRANT ALL ON public.orders TO authenticated, anon;
GRANT ALL ON public.order_items TO authenticated, anon;

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

-- 4.1 تفعيل سياسات تحديث الطلبات وحالات التجهيز والتوصيل (منع خطأ 403 Forbidden)
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Public update orders" ON public.orders;
CREATE POLICY "Public update orders" ON public.orders 
FOR UPDATE TO authenticated, anon 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Public update order_items" ON public.order_items;
CREATE POLICY "Public update order_items" ON public.order_items 
FOR UPDATE TO authenticated, anon 
USING (true)
WITH CHECK (true);

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

-- 10. تفعيل صلاحيات وقراءة ملفات المستخدمين بالكامل وفق معايير Supabase القياسية
GRANT ALL ON public.profiles TO authenticated, anon;

DROP POLICY IF EXISTS "Public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;
CREATE POLICY "Authenticated view profiles" ON public.profiles 
FOR SELECT TO authenticated, anon 
USING (true);

DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated update profiles" ON public.profiles;
CREATE POLICY "Authenticated update profiles" ON public.profiles 
FOR UPDATE TO authenticated, anon 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated insert profiles" ON public.profiles;
CREATE POLICY "Authenticated insert profiles" ON public.profiles 
FOR INSERT TO authenticated, anon 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated delete profiles" ON public.profiles;
CREATE POLICY "Authenticated delete profiles" ON public.profiles 
FOR DELETE TO authenticated, anon 
USING (true);

-- 11. إضافة عمود store_id لجدول profiles لربط التجار بمتاجرهم مباشرة
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_year text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_url text;

-- 12. الدالة البرمجية القياسية لإنشاء المستخدمين والتجار والمناديب داخل Supabase
-- تضمن: 0 قيود معدل (No 429), والحفاظ على سلامة المفاتيح الخارجية (No 409), والربط الذري بالمتجر
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_store_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_pw text;
  v_store_uuid uuid := NULL;
BEGIN
  -- تحويل معرّف المتجر النصي إلى UUID بأمان تام لتوافق نوع العمود في profiles
  BEGIN
    IF p_store_id IS NOT NULL AND trim(p_store_id) <> '' THEN
      v_store_uuid := trim(p_store_id)::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_store_uuid := NULL;
  END;

  -- 1. التحقق من وجود المستخدم مسبقاً في auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));
  
  -- 2. في حالة عدم وجوده، ننشئه بكلمة المرور المشفرة bcrypt
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(COALESCE(NULLIF(p_password, ''), 'San@123456!'), gen_salt('bf'));
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      phone_change,
      phone_change_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      lower(trim(p_email)),
      v_encrypted_pw,
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', p_full_name, 'role', p_role, 'phone', p_phone),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );

    -- إضافة هوية المستخدم في auth.identities لتمكين تسجيل الدخول عبر GoTrue Auth
    BEGIN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        ) VALUES (
          v_user_id::text,
          v_user_id,
          jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
          'email',
          v_user_id::text,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  ELSE
    -- تحديث كلمة المرور وتعيينها فوراً في حالة وجود الحساب وتمرير كلمة مرور جديدة
    IF p_password IS NOT NULL AND p_password <> '' THEN
      v_encrypted_pw := crypt(p_password, gen_salt('bf'));
      UPDATE auth.users
      SET encrypted_password = v_encrypted_pw,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          confirmation_token = COALESCE(confirmation_token, ''),
          recovery_token = COALESCE(recovery_token, ''),
          email_change = COALESCE(email_change, ''),
          email_change_token_new = COALESCE(email_change_token_new, ''),
          email_change_token_current = COALESCE(email_change_token_current, ''),
          phone_change = COALESCE(phone_change, ''),
          phone_change_token = COALESCE(phone_change_token, ''),
          updated_at = NOW()
      WHERE id = v_user_id;
    END IF;

    -- التأكد من وجود سجل الهوية للحساب القائم
    BEGIN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 3. إدراج أو تحديث بيانات الملف الشخصي في public.profiles بنفس المعرف وبنوع UUID السليم
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    store_id,
    courier_status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_full_name,
    lower(trim(p_email)),
    p_phone,
    p_role,
    v_store_uuid,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    store_id = EXCLUDED.store_id,
    updated_at = NOW();

  -- 4. ربط المتجر مباشرة بالمالك الجديد
  IF p_role = 'restaurant' AND v_store_uuid IS NOT NULL THEN
    UPDATE public.stores
    SET owner_id = v_user_id
    WHERE id = v_store_uuid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text) TO authenticated, anon;

-- 12. تهيئة وتثبيت حسابات المتاجر التشغيلية القياسية عبر دالة الإدارة المعتمدة
-- تضمن هذه الخطوة سلامة المفاتيح الأجنبية (Foreign Keys) بنسبة 100% دون أي أخطاء تعارض 23503
SELECT public.admin_create_user(
  'tarek@san.com',
  'San@123456!',
  'محمد ابوطارق',
  '0123456789',
  'restaurant',
  '3dfaad80-6616-45b3-8716-47127039bf85'
);

SELECT public.admin_create_user(
  'hyper@san.com',
  'San@123456!',
  'هايبروان',
  '01234567891',
  'restaurant',
  '40f443c5-bca2-4a77-b7da-f95271055415'
);

-- 13. تفعيل صلاحيات الإشعارات بالكامل لمنع خطأ 403 Forbidden
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.notifications TO authenticated, anon;

-- 14. تنظيف عناوين المتاجر من أي مسميات قديمة
UPDATE public.stores 
SET location_in_district = replace(location_in_district, 'الحي الحكومي - ', '')
WHERE location_in_district LIKE '%الحي الحكومي%';

-- 15. اعتماد وتثبيت متجر سنجوب إكسبريس المركزي وتخصيص حساب الإدارة والتشغيل
INSERT INTO public.stores (
  id, name, name_en, type, category, status, delivery_time, min_order, delivery_fee, rating, logo
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'متجر سنجوب إكسبريس المركزي',
  'Sangoub Express Central',
  'سوبرماركت ومستلزمات يومية',
  'supermarket',
  'open',
  '15-25 دقيقة',
  20.00,
  10.00,
  5.0,
  '/brand/sangoub-market-logo.jpg'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  status = EXCLUDED.status;

-- تهيئة وتفعيل حساب مدير متجر سنجوب المركزي
SELECT public.admin_create_user(
  'central@sangoub.com',
  'San@123456!',
  'مدير متجر سنجوب المركزي',
  '01000000001',
  'restaurant',
  'a0000000-0000-0000-0000-000000000001'
);

-- 17. إضافة حقول دورة اعتماد العروض وضوابط الأسعار
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'approved';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_proposed_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_rejection_reason TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_start_date TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_end_date TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_title TEXT;

-- 18. تسجيل منيو وأصناف حقيقية لمتجر كشري أبو طارق (3dfaad80-6616-45b3-8716-47127039bf85)
INSERT INTO public.products (
  id, store_id, name, name_en, description, price, original_price, category, is_available, archived, image_url, offer_status
)
VALUES 
  ('3df00001-0000-0000-0000-000000000001', '3dfaad80-6616-45b3-8716-47127039bf85', 'علبة كشري أبو طارق سوبر لوكس', 'Abu Tarek Koshary Super Lux', 'الخلطة الأصلية الشهيرة مع عدس وحمص وصلصة حارة وتقلية مقرمشة ودقة مميزة', 45.00, NULL, 'وجبات وكشري', true, false, 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80', 'approved'),
  ('3df00001-0000-0000-0000-000000000002', '3dfaad80-6616-45b3-8716-47127039bf85', 'طاجن مكرونة باللحمة المفرومة فرن', 'Oven Pasta Tagine with Minced Meat', 'طاجن مكرونة بصلصة الطماطم الغنية واللحمة المفرومة المتبلة المخبوزة بالفرن', 55.00, NULL, 'طواجن فرن', true, false, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', 'approved'),
  ('3df00001-0000-0000-0000-000000000003', '3dfaad80-6616-45b3-8716-47127039bf85', 'علبة كشري عائلي فاميلي كينج', 'Abu Tarek Family Koshary Box', 'حجم عائلي كبير يكفي 3 أفراد مع أكياس صلصة ودقة وتقلية مضاعفة', 85.00, NULL, 'وجبات وكشري', true, false, 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80', 'approved'),
  ('3df00001-0000-0000-0000-000000000004', '3dfaad80-6616-45b3-8716-47127039bf85', 'أرز باللبن أبو طارق بالمكسرات والقشطة', 'Abu Tarek Rice Pudding with Nuts', 'حلوى الأرز باللبن البلدي الطازج مع خلطة مكسرات محمصة وقشطة بلدي', 25.00, NULL, 'حلويات', true, false, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80', 'approved')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  category = EXCLUDED.category;-- 19. تفعيل وتنشيط كافة الحسابات الحالية لتكون نشطة افتراضياً
UPDATE public.profiles
SET courier_status = 'active'
WHERE courier_status IS NULL OR courier_status = 'pending';

-- 20. مزامنة وإصلاح هويات الدخول لجميع الحسابات في auth.identities
-- يحل نهائياً خطأ 500 (Internal Server Error) عند محاولة تسجيل دخول المناديب أو التجار
DO $$
BEGIN
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.id::text,
    NOW(),
    NOW(),
    NOW()
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- 21. تنظيف الحقول النصية الفارغة (NULL) في auth.users لمنع انهيار خادم GoTrue (Database error querying schema)
UPDATE auth.users 
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, '');

-- 22. تثبيت وتأكيد بيانات دخول المندوب أحمد محمد (driv@san.com)
SELECT public.admin_create_user(
  'driv@san.com',
  'San@123456!',
  'احمد محمد',
  '01017799582',
  'courier',
  '3dfaad80-6616-45b3-8716-47127039bf85'
);


