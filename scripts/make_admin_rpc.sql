CREATE OR REPLACE FUNCTION public.make_admin(target_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET role = 'admin' WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

