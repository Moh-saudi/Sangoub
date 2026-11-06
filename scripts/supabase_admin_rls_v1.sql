-- Admin order dashboard access through authenticated Supabase sessions.
DROP POLICY IF EXISTS "Admins read all orders" ON public.orders;
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid()
      AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')
  )
);
