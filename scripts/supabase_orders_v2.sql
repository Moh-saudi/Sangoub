-- Pre-launch order model migration. Apply to Supabase before deploying the
-- matching /api/orders handler changes.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS store_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS restaurant_name text,
  ADD COLUMN IF NOT EXISTS discount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS included_tax numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_tax numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coordinates jsonb,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS kitchen_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfillment_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS estimated_delivery text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS departed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_phone text,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_delivery_time text,
  ADD COLUMN IF NOT EXISTS courier_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS picked_up_store_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extra_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.courier_verification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  national_id text NOT NULL,
  emergency_phone text NOT NULL,
  current_address text NOT NULL,
  id_card_address text NOT NULL,
  driving_license_number text,
  license_issue_date date,
  license_expiry_date date,
  vehicle_year text,
  drug_test_status text CHECK (drug_test_status IN ('passed','failed','pending')),
  drug_test_date date,
  criminal_record_status text CHECK (criminal_record_status IN ('passed','failed','pending')),
  criminal_record_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_verification ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_verification FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_verification TO service_role;

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
    ELSIF item.definition ILIKE '%payment_status%' THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', item.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_sangoub_check
    CHECK (status IN ('pending','accepted','received','preparing','ready','assigned','picked_up','with_courier','delivered','cancelled')),
  ADD CONSTRAINT orders_payment_status_sangoub_check
    CHECK (payment_status IN ('pending','paid','failed','refunded','cash_on_delivery'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_request_id_uidx
  ON public.orders(customer_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_created_idx
  ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_courier_active_idx
  ON public.orders(courier_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_active_idx
  ON public.orders(store_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coupons (
  code text PRIMARY KEY,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  value numeric(10,2) NOT NULL CHECK (value >= 0),
  min_order numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_uses IS NULL OR max_uses >= 0)
);

CREATE TABLE IF NOT EXISTS public.order_limits (
  customer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.order_secrets (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  otp_code text NOT NULL CHECK (otp_code ~ '^[0-9]{4}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_fulfillments (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','preparing','ready','picked_up','cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  issue text,
  issue_open boolean NOT NULL DEFAULT false,
  resolution text,
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_by_name text,
  ready_at timestamptz,
  picked_up_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  picked_up_by_name text,
  picked_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id,store_id)
);
CREATE INDEX IF NOT EXISTS order_fulfillments_store_status_idx ON public.order_fulfillments(store_id,status,created_at DESC);
ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_fulfillments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_fulfillments TO service_role;

CREATE TABLE IF NOT EXISTS public.order_payments (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('creating','ready','uncertain','paid')),
  reference_id text UNIQUE,
  provider_id text UNIQUE,
  session_id text,
  redirect_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.geidea_transactions (
  provider_id text PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geidea_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_payments, public.geidea_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments, public.geidea_transactions TO service_role;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'api',
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO service_role;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')
  )
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_limits, public.order_secrets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_limits, public.order_secrets TO service_role;

CREATE OR REPLACE FUNCTION public.create_sangoub_order(
  p_customer_id uuid,
  p_request_id text,
  p_order jsonb,
  p_items jsonb,
  p_otp text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_count integer;
  v_coupon public.coupons%ROWTYPE;
  v_coupon_code text := NULLIF(p_order->>'couponCode','');
BEGIN
  IF p_customer_id IS NULL OR p_request_id IS NULL OR length(p_request_id) > 128 OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ORDER_INPUT' USING ERRCODE = '22023';
  END IF;
  IF p_otp !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'INVALID_OTP' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_existing FROM public.orders
  WHERE customer_id = p_customer_id AND client_request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('created', false, 'order', to_jsonb(v_existing));
  END IF;

  INSERT INTO public.order_limits(customer_id,window_started_at,request_count)
  VALUES (p_customer_id,now(),1)
  ON CONFLICT (customer_id) DO UPDATE SET
    window_started_at = CASE WHEN public.order_limits.window_started_at < now() - interval '24 hours' THEN now() ELSE public.order_limits.window_started_at END,
    request_count = CASE WHEN public.order_limits.window_started_at < now() - interval '24 hours' THEN 1 ELSE public.order_limits.request_count + 1 END
  RETURNING request_count INTO v_count;
  IF v_count > 30 THEN RAISE EXCEPTION 'ORDER_RATE_LIMIT' USING ERRCODE = 'P0001'; END IF;

  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE code = v_coupon_code FOR UPDATE;
    IF NOT FOUND OR NOT v_coupon.active OR (v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now())
       OR (v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now())
       OR (v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses)
       OR COALESCE((p_order->>'subtotal')::numeric,0) < v_coupon.min_order THEN
      RAISE EXCEPTION 'COUPON_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.coupons SET used_count = used_count + 1, updated_at = now() WHERE code = v_coupon_code;
  END IF;

  INSERT INTO public.orders (
    customer_id,client_request_id,order_number,customer_name,customer_phone,store_id,store_ids,restaurant_name,
    status,subtotal,delivery_fee,total_amount,discount,tip,tax_total,included_tax,additional_tax,
    delivery_address,delivery_lat,delivery_lng,coordinates,delivery_ministry,delivery_floor,delivery_room,
    payment_method,payment_status,notes,coupon_code,kitchen_status,fulfillment_version,estimated_delivery,
    is_scheduled,scheduled_delivery_time,created_at,updated_at
  ) VALUES (
    p_customer_id,p_request_id,NULLIF(p_order->>'orderNumber',''),NULLIF(p_order->>'profileName',''),NULLIF(p_order->>'phone',''),
    (p_order->'storeIds'->>0)::uuid,ARRAY(SELECT jsonb_array_elements_text(p_order->'storeIds')::uuid),
    NULLIF(p_order->>'restaurantName',''),COALESCE(NULLIF(p_order->>'orderStatus',''),'received'),
    COALESCE((p_order->>'subtotal')::numeric,0),COALESCE((p_order->>'deliveryFee')::numeric,0),COALESCE((p_order->>'total')::numeric,0),
    COALESCE((p_order->>'discount')::numeric,0),COALESCE((p_order->>'tip')::numeric,0),COALESCE((p_order->>'taxTotal')::numeric,0),
    COALESCE((p_order->>'includedTax')::numeric,0),COALESCE((p_order->>'additionalTax')::numeric,0),
    NULLIF(p_order->>'deliveryAddress',''),(p_order->'coordinates'->>'latitude')::double precision,(p_order->'coordinates'->>'longitude')::double precision,
    NULLIF(p_order->'coordinates','null'::jsonb),NULLIF(p_order->>'ministry',''),NULLIF(p_order->>'floorNumber',''),NULLIF(p_order->>'roomNumber',''),
    COALESCE(NULLIF(p_order->>'paymentMethod',''),'cash'),
    CASE WHEN p_order->>'paymentMethod' = 'cash' THEN 'cash_on_delivery' ELSE 'pending' END,
    NULLIF(p_order->>'notes',''),v_coupon_code,COALESCE(p_order->'kitchenStatus','{}'::jsonb),2,
    NULLIF(p_order->>'estimatedDelivery',''),COALESCE((p_order->>'isScheduled')::boolean,false),NULLIF(p_order->>'scheduledDeliveryTime',''),now(),now()
  ) RETURNING * INTO v_order;

  INSERT INTO public.order_items(order_id,product_id,product_name,price,quantity,selected_options,store_id,extra_price,notes)
  SELECT v_order.id,NULLIF(item->'product'->>'id','')::uuid,
    COALESCE(item->'product'->>'name','صنف'),COALESCE((item->'product'->>'price')::numeric,0),
    COALESCE((item->>'quantity')::integer,1),COALESCE(item->'selectedOptions','{}'::jsonb),
    NULLIF(item->'product'->>'storeId','')::uuid,COALESCE((item->>'extraPrice')::numeric,0),NULLIF(item->>'notes','')
  FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO public.order_fulfillments(order_id,store_id,items)
  SELECT v_order.id,(item->'product'->>'storeId')::uuid,jsonb_agg(item)
  FROM jsonb_array_elements(p_items) AS item
  GROUP BY (item->'product'->>'storeId')::uuid;

  INSERT INTO public.order_secrets(order_id,otp_code) VALUES(v_order.id,p_otp);
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
    VALUES(p_customer_id,'orders.create','orders',v_order.id::text,jsonb_build_object('status',v_order.status,'total',v_order.total_amount),'orders-api');
  RETURN jsonb_build_object('created', true, 'order', to_jsonb(v_order));
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_sangoub_delivery(
  p_order_id uuid,
  p_courier_id uuid,
  p_otp text,
  p_collected_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_secret public.order_secrets%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.courier_id IS DISTINCT FROM p_courier_id THEN RETURN jsonb_build_object('status',403,'error','NOT_ASSIGNED'); END IF;
  IF v_order.status = 'delivered' THEN RETURN jsonb_build_object('status',200,'ok',true); END IF;
  IF v_order.status <> 'with_courier' THEN RETURN jsonb_build_object('status',409,'error','ORDER_NOT_READY_FOR_DELIVERY'); END IF;
  IF EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id = p_order_id AND (status <> 'picked_up' OR picked_up_by IS DISTINCT FROM p_courier_id))
     OR NOT EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('status',409,'error','PICKUP_INCOMPLETE');
  END IF;
  SELECT * INTO v_secret FROM public.order_secrets WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',409,'error','OTP_UNAVAILABLE'); END IF;
  IF v_secret.locked_until IS NOT NULL AND v_secret.locked_until > now() THEN
    RETURN jsonb_build_object('status',429,'error','OTP_LOCKED');
  END IF;
  IF p_otp IS NULL OR p_otp !~ '^[0-9]{4}$' OR p_otp <> v_secret.otp_code THEN
    UPDATE public.order_secrets SET attempts = CASE WHEN attempts + 1 >= 5 THEN 0 ELSE attempts + 1 END,
      locked_until = CASE WHEN attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
      WHERE order_id = p_order_id;
    RETURN jsonb_build_object('status',400,'error','OTP_INVALID');
  END IF;
  IF v_order.payment_method = 'cash' THEN
    IF p_collected_amount IS NULL OR abs(p_collected_amount - v_order.total_amount) > 0.01 THEN
      RETURN jsonb_build_object('status',400,'error','CASH_AMOUNT_MISMATCH');
    END IF;
  ELSIF v_order.payment_status <> 'paid' OR COALESCE(p_collected_amount,0) <> 0 THEN
    RETURN jsonb_build_object('status',400,'error','PAYMENT_NOT_CONFIRMED');
  END IF;

  UPDATE public.orders SET status='delivered',delivered_at=now(),updated_at=now(),payment_status='paid',
    courier_checklist=jsonb_build_object('collectedPayment',true,'collectedAmount',p_collected_amount,'arrivedAtCustomerOffice',true)
    WHERE id=p_order_id;
  DELETE FROM public.order_secrets WHERE order_id=p_order_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
    VALUES(p_courier_id,'orders.delivered','orders',p_order_id::text,jsonb_build_object('status',v_order.status,'payment_status',v_order.payment_status),jsonb_build_object('status','delivered','payment_status','paid','collectedAmount',p_collected_amount),'order-delivery-api');
  RETURN jsonb_build_object('status',200,'ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sangoub_order_otp(p_order_id uuid,p_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_otp text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id=p_order_id AND customer_id=p_customer_id AND status NOT IN ('cancelled','delivered')
  ) THEN RETURN NULL; END IF;
  SELECT otp_code INTO v_otp FROM public.order_secrets WHERE order_id=p_order_id;
  RETURN v_otp;
END;
$$;

CREATE OR REPLACE FUNCTION public.pickup_sangoub_order_store(p_order_id uuid,p_store_id uuid,p_courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.orders%ROWTYPE; v_ticket public.order_fulfillments%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.courier_id IS DISTINCT FROM p_courier_id THEN RETURN jsonb_build_object('status',403,'error','NOT_ASSIGNED'); END IF;
  SELECT * INTO v_ticket FROM public.order_fulfillments WHERE order_id=p_order_id AND store_id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','STORE_NOT_ASSIGNED'); END IF;
  IF v_ticket.status='picked_up' AND v_ticket.picked_up_by=p_courier_id THEN RETURN jsonb_build_object('status',200,'ok',true); END IF;
  IF v_order.status <> 'ready' OR v_ticket.status <> 'ready' OR v_ticket.issue_open OR NOT (v_order.payment_method='cash' OR v_order.payment_status='paid')
    THEN RETURN jsonb_build_object('status',409,'error','STORE_NOT_READY'); END IF;
  UPDATE public.order_fulfillments SET status='picked_up',picked_up_by=p_courier_id,picked_up_at=now(),updated_at=now()
    WHERE order_id=p_order_id AND store_id=p_store_id;
  UPDATE public.orders SET picked_up_store_ids=array_append(picked_up_store_ids,p_store_id),updated_at=now()
    WHERE id=p_order_id AND NOT (p_store_id=ANY(picked_up_store_ids));
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
    VALUES(p_courier_id,'fulfillment.picked_up','orders',p_order_id::text,jsonb_build_object('storeId',p_store_id),'operations-api');
  RETURN jsonb_build_object('status',200,'ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.depart_sangoub_order(p_order_id uuid,p_courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status',404,'error','ORDER_NOT_FOUND'); END IF;
  IF v_order.courier_id IS DISTINCT FROM p_courier_id THEN RETURN jsonb_build_object('status',403,'error','NOT_ASSIGNED'); END IF;
  IF v_order.status='with_courier' THEN RETURN jsonb_build_object('status',200,'ok',true); END IF;
  IF v_order.status <> 'ready' OR NOT (v_order.payment_method='cash' OR v_order.payment_status='paid')
    OR NOT EXISTS(SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id)
    OR EXISTS(SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND status <> 'picked_up')
    THEN RETURN jsonb_build_object('status',409,'error','PICKUP_INCOMPLETE'); END IF;
  UPDATE public.orders SET status='with_courier',departed_at=now(),updated_at=now() WHERE id=p_order_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
    VALUES(p_courier_id,'orders.departed','orders',p_order_id::text,jsonb_build_object('status',v_order.status),jsonb_build_object('status','with_courier'),'operations-api');
  RETURN jsonb_build_object('status',200,'ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_sangoub_payment(p_order_id uuid,p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND customer_id=p_customer_id FOR UPDATE;
  IF NOT FOUND OR v_order.payment_method <> 'geidea' OR v_order.status='cancelled' THEN
    RETURN jsonb_build_object('state','invalid');
  END IF;
  IF v_order.payment_status='paid' THEN RETURN jsonb_build_object('state','paid'); END IF;
  SELECT * INTO v_payment FROM public.order_payments WHERE order_id=p_order_id FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('state',v_payment.state,'referenceId',v_payment.reference_id,'sessionId',v_payment.session_id,'redirectUrl',v_payment.redirect_url,'providerId',v_payment.provider_id,'amount',v_order.total_amount,'customerName',v_order.customer_name); END IF;
  INSERT INTO public.order_payments(order_id,state) VALUES(p_order_id,'creating') RETURNING * INTO v_payment;
  RETURN jsonb_build_object('state','new','amount',v_order.total_amount,'customerName',v_order.customer_name,'referenceId',v_payment.reference_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_sangoub_payment_session(
  p_order_id uuid,p_state text,p_reference_id text DEFAULT NULL,p_provider_id text DEFAULT NULL,p_session_id text DEFAULT NULL,p_redirect_url text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_state NOT IN ('ready','uncertain') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE'; END IF;
  UPDATE public.order_payments SET state=p_state,reference_id=p_reference_id,provider_id=p_provider_id,session_id=p_session_id,redirect_url=p_redirect_url,updated_at=now()
    WHERE order_id=p_order_id AND state='creating';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sangoub_payment(
  p_order_id uuid,p_provider_id text,p_reference_id text,p_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.order_payments%ROWTYPE;
  v_claimed uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.payment_method <> 'geidea' OR v_order.order_number IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_payment FROM public.order_payments WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_payment.reference_id IS DISTINCT FROM p_reference_id THEN RETURN false; END IF;
  IF round(v_order.total_amount,2) <> round(p_amount,2) THEN RETURN false; END IF;
  IF v_order.payment_status='paid' THEN RETURN v_payment.provider_id=p_provider_id; END IF;
  INSERT INTO public.geidea_transactions(provider_id,order_id) VALUES(p_provider_id,p_order_id) ON CONFLICT DO NOTHING;
  SELECT order_id INTO v_claimed FROM public.geidea_transactions WHERE provider_id=p_provider_id;
  IF v_claimed IS DISTINCT FROM p_order_id THEN RETURN false; END IF;
  UPDATE public.orders SET payment_status='paid',payment_confirmed_at=now(),updated_at=now() WHERE id=p_order_id;
  UPDATE public.order_payments SET state='paid',provider_id=p_provider_id,updated_at=now() WHERE order_id=p_order_id;
  INSERT INTO public.audit_logs(action,entity_type,entity_id,before_state,after_state,source)
    VALUES('payment.confirmed','orders',p_order_id::text,jsonb_build_object('payment_status',v_order.payment_status),jsonb_build_object('payment_status','paid','providerId',p_provider_id),'geidea-callback');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sangoub_order(uuid,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sangoub_order(uuid,text,jsonb,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_sangoub_delivery(uuid,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sangoub_delivery(uuid,uuid,text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.get_sangoub_order_otp(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sangoub_order_otp(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.pickup_sangoub_order_store(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pickup_sangoub_order_store(uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.depart_sangoub_order(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.depart_sangoub_order(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.claim_sangoub_payment(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sangoub_payment(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finish_sangoub_payment_session(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_sangoub_payment_session(uuid,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_sangoub_payment(uuid,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_sangoub_payment(uuid,text,text,numeric) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='order_fulfillments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_fulfillments;
  END IF;
END $$;
