-- ==============================================================================
-- 🚀 SANGOUB - CLEAN CORRUPTED QUESTION-MARK NAMES (UTF-8 FIX)
-- شغل هذا الكود في Supabase SQL Editor لإصلاح الأسماء التي خُرِّبت بعلامات استفهام
-- ==============================================================================

-- 1. إصلاح الأسماء في جدول المستخدمين (profiles)
UPDATE public.profiles
SET full_name = CASE
  WHEN role = 'courier' THEN 'كابتن توصيل'
  WHEN role = 'restaurant' THEN 'شريك متجر'
  WHEN role = 'admin' THEN 'مدير النظام'
  ELSE 'عميل سنجوب'
END
WHERE full_name ~ '[\?؟]{2,}' OR full_name ~ '^[\?\s؟]+$';

-- 2. إصلاح أسماء المناديب في جدول الطلبات (orders)
UPDATE public.orders
SET courier_name = 'كابتن توصيل'
WHERE courier_name ~ '[\?؟]{2,}' OR courier_name ~ '^[\?\s؟]+$';

-- 3. إصلاح أسماء العملاء في جدول الطلبات (orders)
UPDATE public.orders
SET customer_name = 'عميل سنجوب'
WHERE customer_name ~ '[\?؟]{2,}' OR customer_name ~ '^[\?\s؟]+$';

