-- Realtime tracking: Supabase is the source of truth; Firebase is not used here.
-- Run after confirming the live orders, stores, user_roles and courier_locations tables.

DROP POLICY IF EXISTS "Courier location readable by all authenticated" ON public.courier_locations;
DROP POLICY IF EXISTS "Courier can update own location" ON public.courier_locations;
DROP POLICY IF EXISTS "Authorized parties can read courier location" ON public.courier_locations;

CREATE POLICY "Authorized parties can read courier location"
ON public.courier_locations
FOR SELECT
TO authenticated
USING (
  auth.uid() = courier_id
  OR EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    JOIN public.roles AS r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND lower(COALESCE(r.name_en, r.name_ar, '')) IN ('super admin', 'مدير النظام', 'مدير المنظومة')
  )
  OR EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.courier_id = courier_locations.courier_id
      AND o.status IN ('assigned', 'picked_up', 'with_courier')
      AND (
        o.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.user_roles AS ur
          WHERE ur.user_id = auth.uid()
            AND ur.store_id = o.store_id
        )
      )
  )
);
