-- ==============================================================================
-- سكريبت الإصلاح الشامل والنهائي لخطأ 500 (Internal Server Error) عند تسجيل الدخول
-- Database Error Querying Schema / Scan Error on auth.users & auth.identities
-- ==============================================================================

-- 1. التأكد من توفر إضافة pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. تنظيف وتطهير كافة الحقول النصية والمنطقية في auth.users
-- خادم Supabase Auth (GoTrue) ينهار فوراً برمز 500 إذا وجد NULL في حقول التوكنات أو الحقول المنطقية
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  is_super_admin = COALESCE(is_super_admin, false),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false),
  aud = 'authenticated',
  role = 'authenticated',
  instance_id = '00000000-0000-0000-0000-000000000000',
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE 
  confirmation_token IS NULL 
  OR recovery_token IS NULL 
  OR reauthentication_token IS NULL
  OR is_super_admin IS NULL
  OR is_sso_user IS NULL
  OR is_anonymous IS NULL
  OR email = 'driv@san.com';

-- 3. في حالة عدم وجود المستخدم driv@san.com نقوم بإنشائه بشكل مطابق 100% لمعايير GoTrue
DO $$
DECLARE
  v_uid uuid;
  v_pw_hash text;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'driv@san.com';
  v_pw_hash := extensions.crypt('San@123456!', extensions.gen_salt('bf'));

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
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
      phone_change_token,
      reauthentication_token,
      is_super_admin,
      is_sso_user,
      is_anonymous
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'driv@san.com',
      v_pw_hash,
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "احمد محمد", "role": "courier", "phone": "01017799582"}'::jsonb,
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
      '',
      '',
      false,
      false,
      false
    );
  ELSE
    -- تحديث كلمة المرور وتأكيد الحساب وإزالة أي خلل
    UPDATE auth.users
    SET 
      encrypted_password = v_pw_hash,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb,
      raw_user_meta_data = jsonb_build_object('full_name', 'احمد محمد', 'role', 'courier', 'phone', '01017799582'),
      confirmation_token = '',
      recovery_token = '',
      email_change = '',
      email_change_token_new = '',
      email_change_token_current = '',
      phone_change = '',
      phone_change_token = '',
      reauthentication_token = '',
      is_super_admin = false,
      is_sso_user = false,
      is_anonymous = false,
      aud = 'authenticated',
      role = 'authenticated',
      updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  -- 4. تطهير وإعادة بناء سجل الهوية في auth.identities
  -- خادم Supabase يرجع 500 حتماً إذا غاب سجل identities أو احتوى على معرف غير متطابق
  DELETE FROM auth.identities WHERE user_id = v_uid OR provider_id = v_uid::text;

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
    v_uid,
    v_uid,
    jsonb_build_object(
      'sub', v_uid::text,
      'email', 'driv@san.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_uid::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- 5. مزامنة الملف الشخصي في public.profiles برتبة كابتن نشط
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    courier_status,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    'احمد محمد',
    'driv@san.com',
    '01017799582',
    'courier',
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'courier',
    courier_status = 'active',
    full_name = 'احمد محمد',
    phone = '01017799582',
    updated_at = NOW();

END $$;

-- 6. استعلام الفحص والتأكيد النهائي (يجب أن يعيد سطر واحد وكل القيم true)
SELECT 
  u.id,
  u.email,
  (u.email_confirmed_at IS NOT NULL) AS is_email_confirmed,
  (u.encrypted_password IS NOT NULL) AS is_password_ready,
  (i.id IS NOT NULL) AS has_valid_identity,
  p.role AS profile_role,
  p.courier_status AS profile_status
FROM auth.users u
JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'driv@san.com';

