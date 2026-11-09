-- ==============================================================================
-- 🚀 SANGOUB - FIX DELIVERY & NOTIFICATIONS SCHEMA & PERMISSIONS
-- Run this script in Supabase SQL Editor to ensure flawless order lifecycles
-- ==============================================================================

-- 1. Ensure required columns exist on public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_phone text,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_checklist jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS receipt_url text;

-- 2. Update status constraint on public.orders to support with_courier and picked_up
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass AND contype = 'c'
  LOOP
    IF item.definition ~* '(^|[ (])status([ )]|$)' AND item.definition NOT ILIKE '%payment_status%' THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', item.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_sangoub_full_check
    CHECK (status IN (
      'pending', 'accepted', 'received', 'preparing', 'ready', 
      'assigned', 'picked_up', 'with_courier', 'delivered', 'cancelled'
    ));

-- 3. Ensure permissions and open access on public.notifications
GRANT ALL ON public.notifications TO authenticated, anon, service_role;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 4. Enable Realtime on orders and notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 5. Automated database trigger for order lifecycle notifications (Customer & Merchant)
CREATE OR REPLACE FUNCTION public.trg_notify_order_events()
RETURNS TRIGGER AS $$
DECLARE
  v_num text;
  v_cname text;
  v_merchant_id uuid;
BEGIN
  v_num := COALESCE(NEW.order_number, substring(NEW.id::text from 1 for 8));
  v_cname := COALESCE(NEW.courier_name, 'كابتن سنجوب');

  -- Notification on status transitions
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Case A: Courier picked up order (with_courier / picked_up)
    IF NEW.status IN ('with_courier', 'picked_up') THEN
      -- Notify customer
      IF NEW.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, data, is_read, created_at)
        VALUES (
          NEW.customer_id,
          'المندوب استلم طلبك وهو في الطريق إليك 🛵',
          'استلم ' || v_cname || ' طلبك رقم #' || v_num || ' من المتجر وهو متوجه إليك الآن.',
          'order',
          jsonb_build_object('orderId', NEW.id, 'status', NEW.status),
          false,
          now()
        );
      END IF;

      -- Notify store owner / merchants
      IF NEW.store_id IS NOT NULL THEN
        FOR v_merchant_id IN
          SELECT id FROM public.profiles WHERE store_id = NEW.store_id OR (role = 'merchant' AND store_id = NEW.store_id)
        LOOP
          INSERT INTO public.notifications (user_id, title, body, type, data, is_read, created_at)
          VALUES (
            v_merchant_id,
            'تم استلام الطلب من المحل 📦',
            'استلم ' || v_cname || ' الطلب رقم #' || v_num || ' بنجاح وانطلق لتسليمه للعميل.',
            'order',
            jsonb_build_object('orderId', NEW.id, 'status', NEW.status),
            false,
            now()
          );
        END LOOP;
      END IF;

    -- Case B: Order delivered
    ELSIF NEW.status = 'delivered' THEN
      -- Notify customer
      IF NEW.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, data, is_read, created_at)
        VALUES (
          NEW.customer_id,
          'تم تسليم طلبك بنجاح 🎉',
          'تم تسليم طلبك رقم #' || v_num || ' بنجاح! شكراً لاختيارك منصة سنجوب.',
          'order',
          jsonb_build_object('orderId', NEW.id, 'status', 'delivered'),
          false,
          now()
        );
      END IF;

      -- Notify merchant
      IF NEW.store_id IS NOT NULL THEN
        FOR v_merchant_id IN
          SELECT id FROM public.profiles WHERE store_id = NEW.store_id OR (role = 'merchant' AND store_id = NEW.store_id)
        LOOP
          INSERT INTO public.notifications (user_id, title, body, type, data, is_read, created_at)
          VALUES (
            v_merchant_id,
            'اكتمل تسليم الطلب للعميل ✅',
            'أكّد ' || v_cname || ' تسليم الطلب رقم #' || v_num || ' للعميل بنجاح وتم إغلاق الفاتورة.',
            'order',
            jsonb_build_object('orderId', NEW.id, 'status', 'delivered'),
            false,
            now()
          );
        END LOOP;
      END IF;

    -- Case C: Order ready for pickup
    ELSIF NEW.status = 'ready' THEN
      IF NEW.customer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, data, is_read, created_at)
        VALUES (
          NEW.customer_id,
          'طلبك جاهز بالمحل 📦',
          'تم تجهيز طلبك رقم #' || v_num || ' بنجاح وفي انتظار انطلاق المندوب.',
          'order',
          jsonb_build_object('orderId', NEW.id, 'status', 'ready'),
          false,
          now()
        );
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_orders_lifecycle_notifications ON public.orders;
CREATE TRIGGER trg_orders_lifecycle_notifications
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_order_events();
