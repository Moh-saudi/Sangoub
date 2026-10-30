CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_admin_count INT;
  v_role TEXT;
BEGIN
  SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
  IF v_admin_count = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'employee');
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'مسؤول المنصة'),
    new.email,
    new.phone,
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

