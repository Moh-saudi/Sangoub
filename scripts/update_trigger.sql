CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, ministry, floor_number, room_number, wallet_balance, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'عميل سنجوب'),
    new.email,
    new.phone,
    COALESCE(new.raw_user_meta_data->>'ministry', ''),
    COALESCE(new.raw_user_meta_data->>'floor_number', ''),
    COALESCE(new.raw_user_meta_data->>'room_number', ''),
    0,
    'employee'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

