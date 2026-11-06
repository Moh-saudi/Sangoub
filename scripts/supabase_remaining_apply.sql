
-- === APPLY: scripts/supabase_shared_catalog_v1.sql ===
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'غير مصنف',
  image_type text,
  image_url text,
  option_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  origin text NOT NULL DEFAULT 'admin' CHECK(origin IN ('admin','published-product')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.catalog_offers (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  catalog_product_id text NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,catalog_product_id)
);
CREATE INDEX IF NOT EXISTS catalog_products_active_id_idx ON public.catalog_products(id) WHERE active;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_products,public.catalog_offers FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.catalog_products,public.catalog_offers TO service_role;

CREATE OR REPLACE FUNCTION public.publish_sangoub_catalog_product(p_product_id text,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_product public.products%ROWTYPE; v_catalog_id text;
BEGIN
  IF p_product_id !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id::uuid FOR UPDATE;
  IF NOT FOUND OR v_product.archived THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  v_catalog_id:=COALESCE(NULLIF(v_product.catalog_product_id,''),p_product_id);
  IF NOT EXISTS(SELECT 1 FROM public.catalog_products WHERE id=v_catalog_id) THEN
    INSERT INTO public.catalog_products(id,name,description,category,image_type,image_url,option_groups,active,created_by)
    VALUES(v_catalog_id,left(btrim(v_product.name),120),left(COALESCE(v_product.description,''),1000),left(COALESCE(NULLIF(btrim(v_product.category),''),'غير مصنف'),120),v_product.image_type,v_product.image_url,COALESCE(v_product.options,'[]'::jsonb),true,p_actor_id);
  END IF;
  UPDATE public.products SET catalog_product_id=v_catalog_id,updated_at=now() WHERE id=v_product.id;
  INSERT INTO public.catalog_offers(store_id,catalog_product_id,product_id) VALUES(v_product.store_id,v_catalog_id,v_product.id)
  ON CONFLICT(store_id,catalog_product_id) DO NOTHING;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
  VALUES(p_actor_id,'catalog.publish','catalog_products',v_catalog_id,jsonb_build_object('sourceProductId',v_product.id),'admin-data-api');
  RETURN jsonb_build_object('ok',true,'catalogProductId',v_catalog_id);
END $$;
REVOKE ALL ON FUNCTION public.publish_sangoub_catalog_product(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_sangoub_catalog_product(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.link_sangoub_catalog_product(p_store_id uuid,p_catalog_product_id text,p_price numeric,p_existing_product_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_catalog public.catalog_products%ROWTYPE; v_source public.products%ROWTYPE; v_link public.catalog_offers%ROWTYPE; v_product public.products%ROWTYPE;
BEGIN
  IF p_store_id IS NULL OR p_catalog_product_id IS NULL OR p_price<0 OR p_price>100000 OR p_actor_id IS NULL THEN RAISE EXCEPTION 'INVALID_CATALOG_INPUT' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.stores WHERE id=p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_catalog FROM public.catalog_products WHERE id=p_catalog_product_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_catalog_product_id !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    SELECT * INTO v_source FROM public.products WHERE id=p_catalog_product_id::uuid AND is_available AND NOT archived AND NULLIF(catalog_product_id,'') IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    INSERT INTO public.catalog_products(id,name,description,category,image_type,image_url,option_groups,active,origin,created_by)
    VALUES(v_source.id::text,left(btrim(v_source.name),120),left(COALESCE(v_source.description,''),1000),left(COALESCE(NULLIF(btrim(v_source.category),''),'غير مصنف'),120),v_source.image_type,v_source.image_url,COALESCE(v_source.options,'[]'::jsonb),true,'published-product',p_actor_id)
    RETURNING * INTO v_catalog;
    UPDATE public.products SET catalog_product_id=v_catalog.id,updated_at=now() WHERE id=v_source.id;
    IF v_source.store_id IS NOT NULL THEN
      INSERT INTO public.catalog_offers(store_id,catalog_product_id,product_id) VALUES(v_source.store_id,v_catalog.id,v_source.id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  IF NOT v_catalog.active THEN RAISE EXCEPTION 'CATALOG_PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_link FROM public.catalog_offers WHERE store_id=p_store_id AND catalog_product_id=p_catalog_product_id;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'id',v_link.product_id,'alreadyLinked',true); END IF;
  IF p_existing_product_id IS NOT NULL THEN
    SELECT * INTO v_product FROM public.products WHERE id=p_existing_product_id AND store_id=p_store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_OWNED' USING ERRCODE='42501'; END IF;
    IF NULLIF(v_product.catalog_product_id,'') IS NOT NULL AND v_product.catalog_product_id<>p_catalog_product_id THEN RAISE EXCEPTION 'PRODUCT_NOT_OWNED' USING ERRCODE='42501'; END IF;
    UPDATE public.products SET name=v_catalog.name,description=v_catalog.description,category=v_catalog.category,image_type=v_catalog.image_type,image_url=v_catalog.image_url,options=v_catalog.option_groups,catalog_product_id=p_catalog_product_id,updated_at=now()
      WHERE id=v_product.id RETURNING * INTO v_product;
  ELSE
    INSERT INTO public.products(store_id,name,description,price,category,image_type,image_url,options,is_available,archived,catalog_product_id)
    VALUES(p_store_id,v_catalog.name,v_catalog.description,p_price,v_catalog.category,v_catalog.image_type,v_catalog.image_url,v_catalog.option_groups,false,false,p_catalog_product_id)
    RETURNING * INTO v_product;
  END IF;
  INSERT INTO public.catalog_offers(store_id,catalog_product_id,product_id) VALUES(p_store_id,p_catalog_product_id,v_product.id);
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
  VALUES(p_actor_id,'merchant.catalog-link','products',v_product.id::text,jsonb_build_object('storeId',p_store_id,'catalogProductId',p_catalog_product_id),'operations-api');
  RETURN jsonb_build_object('ok',true,'id',v_product.id,'alreadyLinked',false);
END $$;
REVOKE ALL ON FUNCTION public.link_sangoub_catalog_product(uuid,text,numeric,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_sangoub_catalog_product(uuid,text,numeric,uuid,uuid) TO service_role;

-- === APPLY: scripts/supabase_operations_v1.sql ===
CREATE OR REPLACE FUNCTION public.cancel_sangoub_order(p_order_id uuid,p_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id AND customer_id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_order.status='cancelled' THEN RETURN jsonb_build_object('ok',true,'alreadyCancelled',true); END IF;
  IF v_order.status<>'received' OR (v_order.payment_method<>'cash' AND v_order.payment_status='paid')
    OR EXISTS(SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND status<>'received') THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED' USING ERRCODE='23514';
  END IF;
  UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p_order_id;
  UPDATE public.order_fulfillments SET status='cancelled',updated_at=now() WHERE order_id=p_order_id AND status='received';
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
    VALUES(p_customer_id,'orders.cancelled','orders',p_order_id::text,jsonb_build_object('status',v_order.status),jsonb_build_object('status','cancelled'),'operations-api');
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.cancel_sangoub_order(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sangoub_order(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.update_sangoub_fulfillment(
 p_order_id uuid,p_store_id uuid,p_actor_id uuid,p_action text,p_next text DEFAULT NULL,p_checked_item_ids jsonb DEFAULT '[]'::jsonb,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE; v_ticket public.order_fulfillments%ROWTYPE; v_all_ready boolean; v_expected_count integer; v_checked_count integer;
BEGIN
  IF p_action NOT IN ('prepare','report-issue','resolve-issue') THEN RAISE EXCEPTION 'INVALID_FULFILLMENT_ACTION' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_ticket FROM public.order_fulfillments WHERE order_id=p_order_id AND store_id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FULFILLMENT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_action='resolve-issue' THEN
    IF NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
    IF length(btrim(COALESCE(p_reason,'')))<5 OR length(p_reason)>500 THEN RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE='22023'; END IF;
    UPDATE public.order_fulfillments SET issue_open=false,resolution=btrim(p_reason),updated_at=now() WHERE order_id=p_order_id AND store_id=p_store_id;
    INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source) VALUES(p_actor_id,'fulfillment.issue.resolved','orders',p_order_id::text,jsonb_build_object('storeId',p_store_id,'reason',btrim(p_reason)),'operations-api');
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND ur.store_id=p_store_id AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('store owner','store manager','kitchen & prep staff','مالك المتجر','مدير المتجر','طاقم المطبخ والتحضير'))
     AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND lower(COALESCE(r.name_en,r.name_ar,'')) IN ('super admin','مدير النظام','مدير المنظومة')) THEN RAISE EXCEPTION 'STORE_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_action='report-issue' THEN
    IF length(btrim(COALESCE(p_reason,'')))<5 OR length(p_reason)>500 OR v_ticket.status='picked_up' THEN RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE='22023'; END IF;
    UPDATE public.order_fulfillments SET issue=btrim(p_reason),issue_open=true,updated_at=now() WHERE order_id=p_order_id AND store_id=p_store_id;
    INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source) VALUES(p_actor_id,'fulfillment.issue','orders',p_order_id::text,jsonb_build_object('storeId',p_store_id,'reason',btrim(p_reason)),'operations-api');
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF p_next NOT IN ('preparing','ready') OR v_ticket.issue_open OR v_ticket.status='picked_up'
    OR NOT (v_order.payment_method='cash' OR (v_order.payment_status='paid' AND v_order.payment_confirmed_at IS NOT NULL)) THEN RAISE EXCEPTION 'FULFILLMENT_NOT_READY' USING ERRCODE='23514'; END IF;
  IF p_next='preparing' AND v_ticket.status<>'received' OR p_next='ready' AND v_ticket.status<>'preparing' THEN
    IF v_ticket.status=p_next THEN RETURN jsonb_build_object('ok',true,'alreadyApplied',true); END IF;
    RAISE EXCEPTION 'FULFILLMENT_STALE' USING ERRCODE='40001';
  END IF;
  IF p_next='ready' THEN
    SELECT count(*) INTO v_expected_count FROM jsonb_array_elements(v_ticket.items);
    SELECT count(DISTINCT value) INTO v_checked_count FROM jsonb_array_elements_text(p_checked_item_ids);
    IF jsonb_typeof(p_checked_item_ids)<>'array' OR v_expected_count<>v_checked_count OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_ticket.items) WITH ORDINALITY item(value,idx)
      WHERE NOT (p_checked_item_ids ? COALESCE(item.value->>'id',(item.idx-1)::text))
    ) THEN RAISE EXCEPTION 'ITEM_CHECKLIST_REQUIRED' USING ERRCODE='22023'; END IF;
  END IF;
  UPDATE public.order_fulfillments SET status=p_next,checked_item_ids=CASE WHEN p_next='ready' THEN p_checked_item_ids ELSE '[]'::jsonb END,prepared_by=p_actor_id,ready_at=CASE WHEN p_next='ready' THEN now() ELSE ready_at END,updated_at=now()
    WHERE order_id=p_order_id AND store_id=p_store_id;
  SELECT bool_and(status IN ('ready','picked_up')) INTO v_all_ready FROM public.order_fulfillments WHERE order_id=p_order_id;
  UPDATE public.orders SET status=CASE WHEN p_next='ready' AND v_all_ready THEN 'ready' ELSE 'preparing' END,ready_at=CASE WHEN p_next='ready' AND v_all_ready THEN now() ELSE ready_at END,updated_at=now() WHERE id=p_order_id;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source) VALUES(p_actor_id,'fulfillment.'||p_next,'orders',p_order_id::text,jsonb_build_object('storeId',p_store_id,'status',p_next),'operations-api');
  RETURN jsonb_build_object('ok',true,'orderStatus',CASE WHEN p_next='ready' AND v_all_ready THEN 'ready' ELSE 'preparing' END);
END $$;
REVOKE ALL ON FUNCTION public.update_sangoub_fulfillment(uuid,uuid,uuid,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_sangoub_fulfillment(uuid,uuid,uuid,text,text,jsonb,text) TO service_role;

-- === APPLY: scripts/supabase_analytics_v1.sql ===
CREATE TABLE IF NOT EXISTS public.site_visitors (
  visitor_hash text PRIMARY KEY CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  last_day date NOT NULL,
  source text NOT NULL DEFAULT 'direct',
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.site_visitor_days (
  day date PRIMARY KEY,
  visitors bigint NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  events jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.site_visitor_totals (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  visitors bigint NOT NULL DEFAULT 0,
  started_at timestamptz,
  analytics_started_at timestamptz
);
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_visitors, public.site_visitor_days, public.site_visitor_totals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_visitors, public.site_visitor_days, public.site_visitor_totals TO service_role;

CREATE OR REPLACE FUNCTION public.record_sangoub_site_visit(p_hash text,p_day date,p_source text,p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.site_visitors%ROWTYPE; v_exists boolean; v_same boolean; v_new_source boolean; v_new_event boolean; v_new_visitor boolean;
BEGIN
  IF p_hash !~ '^[a-f0-9]{64}$' OR p_source NOT IN ('facebook','whatsapp','instagram','search','other','direct')
    OR (p_event IS NOT NULL AND p_event NOT IN ('mascot_open','breakfast','supermarket','review_breakfast','review_supermarket','whatsapp_breakfast','whatsapp_supermarket','whatsapp_support')) THEN
    RAISE EXCEPTION 'INVALID_SITE_VISIT' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.site_visitor_totals(id,visitors,started_at,analytics_started_at)
  VALUES(true,0,now(),now()) ON CONFLICT(id) DO NOTHING;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_hash,0));
  SELECT * INTO v_old FROM public.site_visitors WHERE visitor_hash=p_hash FOR UPDATE;
  v_exists := FOUND;
  v_new_visitor := NOT v_exists;
  v_same := v_exists AND v_old.last_day=p_day;
  v_new_source := NOT v_same OR NULLIF(v_old.source,'') IS NULL;
  v_new_event := p_event IS NOT NULL AND (NOT v_same OR NOT (v_old.events ? p_event));
  IF NOT v_same OR v_new_source OR v_new_event THEN
    INSERT INTO public.site_visitors(visitor_hash,last_day,source,events)
    VALUES(p_hash,p_day,p_source,CASE WHEN p_event IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p_event) END)
    ON CONFLICT(visitor_hash) DO UPDATE SET last_day=EXCLUDED.last_day,
      source=CASE WHEN v_new_source THEN p_source ELSE public.site_visitors.source END,
      events=CASE WHEN v_same AND p_event IS NOT NULL AND v_new_event THEN public.site_visitors.events || jsonb_build_array(p_event)
        WHEN NOT v_same AND p_event IS NOT NULL THEN jsonb_build_array(p_event)
        WHEN NOT v_same THEN '[]'::jsonb ELSE public.site_visitors.events END;
    INSERT INTO public.site_visitor_days(day,visitors,sources,events)
    VALUES(p_day,CASE WHEN v_same THEN 0 ELSE 1 END,
      CASE WHEN v_new_source THEN jsonb_build_object(p_source,1) ELSE '{}'::jsonb END,
      CASE WHEN v_new_event THEN jsonb_build_object(p_event,1) ELSE '{}'::jsonb END)
    ON CONFLICT(day) DO UPDATE SET
      visitors=public.site_visitor_days.visitors+EXCLUDED.visitors,
      sources=CASE WHEN v_new_source THEN jsonb_set(public.site_visitor_days.sources,ARRAY[p_source],to_jsonb(COALESCE((public.site_visitor_days.sources->>p_source)::bigint,0)+1),true) ELSE public.site_visitor_days.sources END,
      events=CASE WHEN v_new_event THEN jsonb_set(public.site_visitor_days.events,ARRAY[p_event],to_jsonb(COALESCE((public.site_visitor_days.events->>p_event)::bigint,0)+1),true) ELSE public.site_visitor_days.events END;
  END IF;
  IF v_new_visitor THEN UPDATE public.site_visitor_totals SET visitors=visitors+1 WHERE id=true; END IF;
  UPDATE public.site_visitor_totals SET analytics_started_at=COALESCE(analytics_started_at,now()),started_at=COALESCE(started_at,now()) WHERE id=true;
END $$;
REVOKE ALL ON FUNCTION public.record_sangoub_site_visit(text,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_sangoub_site_visit(text,date,text,text) TO service_role;

-- === APPLY: scripts/supabase_requests_v1.sql ===
CREATE TABLE IF NOT EXISTS public.sangoub_requests (
  id text PRIMARY KEY CHECK (id ~ '^SNG-[a-f0-9-]{36}$'),
  kind text NOT NULL CHECK (kind IN ('breakfast','supermarket')),
  name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  office text NOT NULL,
  notes text NOT NULL DEFAULT '',
  payment text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_quantity integer NOT NULL CHECK (total_quantity >= 0),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','completed','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  admin_note text,
  source text NOT NULL DEFAULT 'sangoub-web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sangoub_requests_created_idx ON public.sangoub_requests(created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS public.sangoub_request_limits (
  phone_hash text PRIMARY KEY CHECK (phone_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK(request_count>=0)
);
ALTER TABLE public.sangoub_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sangoub_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sangoub_requests,public.sangoub_request_limits FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sangoub_requests,public.sangoub_request_limits TO service_role;

CREATE OR REPLACE FUNCTION public.create_sangoub_request(p_id text,p_kind text,p_data jsonb,p_fingerprint text,p_phone_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_existing public.sangoub_requests%ROWTYPE; v_count integer; v_recent boolean;
BEGIN
  IF p_id !~ '^SNG-[a-f0-9-]{36}$' OR p_kind NOT IN ('breakfast','supermarket') OR jsonb_typeof(p_data)<>'object'
    OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_phone_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_SANGOUB_REQUEST' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id,0));
  SELECT * INTO v_existing FROM public.sangoub_requests WHERE id=p_id;
  IF FOUND THEN
    IF v_existing.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'SANGOUB_REQUEST_CONFLICT' USING ERRCODE='23505'; END IF;
    RETURN jsonb_build_object('id',p_id,'duplicate',true);
  END IF;
  INSERT INTO public.sangoub_request_limits(phone_hash,window_started_at,request_count) VALUES(p_phone_hash,now(),1)
  ON CONFLICT(phone_hash) DO UPDATE SET
    window_started_at=CASE WHEN public.sangoub_request_limits.window_started_at<now()-interval '24 hours' THEN now() ELSE public.sangoub_request_limits.window_started_at END,
    request_count=CASE WHEN public.sangoub_request_limits.window_started_at<now()-interval '24 hours' THEN 1 ELSE public.sangoub_request_limits.request_count+1 END
  RETURNING request_count INTO v_count;
  IF v_count>10 THEN RAISE EXCEPTION 'SANGOUB_REQUEST_RATE_LIMIT' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.sangoub_requests(id,kind,name,phone,address,office,notes,payment,items,total_quantity,fingerprint)
  VALUES(p_id,p_kind,left(btrim(p_data->>'name'),120),left(btrim(p_data->>'phone'),30),left(btrim(p_data->>'address'),500),
    left(btrim(p_data->>'office'),120),left(btrim(p_data->>'notes'),500),left(btrim(p_data->>'payment'),40),
    COALESCE(p_data->'items','[]'::jsonb),COALESCE((p_data->>'totalQuantity')::integer,0),p_fingerprint);
  RETURN jsonb_build_object('id',p_id,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.create_sangoub_request(text,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_sangoub_request(text,text,jsonb,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_sangoub_request(p_id text,p_actor_id uuid,p_expected_status text,p_expected_version integer,p_status text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before public.sangoub_requests%ROWTYPE; v_after public.sangoub_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM public.sangoub_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SANGOUB_REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_before.status<>p_expected_status OR v_before.version<>p_expected_version THEN RAISE EXCEPTION 'SANGOUB_REQUEST_STALE' USING ERRCODE='40001'; END IF;
  IF p_status NOT IN ('new','contacted','completed','cancelled') OR length(btrim(p_note))=0 OR length(p_note)>500 THEN RAISE EXCEPTION 'INVALID_SANGOUB_REQUEST_UPDATE' USING ERRCODE='22023'; END IF;
  UPDATE public.sangoub_requests SET status=p_status,version=version+1,admin_note=btrim(p_note),updated_at=now() WHERE id=p_id RETURNING * INTO v_after;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,reason,source)
  VALUES(p_actor_id,'sangoub.followup','sangoub_requests',p_id,jsonb_build_object('status',v_before.status),
    jsonb_build_object('status',v_after.status,'note',v_after.admin_note),'','admin-data-api');
  RETURN jsonb_build_object('ok',true,'version',v_after.version);
END $$;
REVOKE ALL ON FUNCTION public.admin_update_sangoub_request(text,uuid,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sangoub_request(text,uuid,text,integer,text,text) TO service_role;

-- === APPLY: scripts/supabase_app_content_v1.sql ===
CREATE TABLE IF NOT EXISTS public.app_content (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_content FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_content TO service_role;

