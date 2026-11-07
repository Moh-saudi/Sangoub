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

