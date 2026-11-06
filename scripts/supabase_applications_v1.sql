CREATE TABLE IF NOT EXISTS public.partner_applications (
  id text PRIMARY KEY,
  business_name text NOT NULL,
  partner_type text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  branches_count text NOT NULL DEFAULT '1',
  location_in_capital text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','rejected')),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_applications_status_created_idx ON public.partner_applications(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_applications_status_created_idx ON public.job_applications(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.partner_application_limits (
  phone_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_applications,public.job_applications FROM anon,authenticated;
REVOKE ALL ON public.partner_application_limits FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.partner_applications,public.job_applications TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.partner_application_limits TO service_role;

CREATE OR REPLACE FUNCTION public.create_sangoub_partner_application(p_id text,p_payload jsonb,p_phone_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer; v_application public.partner_applications%ROWTYPE;
BEGIN
  IF p_id IS NULL OR length(p_id)>80 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR p_phone_hash !~ '^[a-f0-9]{64}$' OR NULLIF(btrim(p_payload->>'businessName'),'') IS NULL
     OR NULLIF(btrim(p_payload->>'contactName'),'') IS NULL OR NULLIF(btrim(p_payload->>'phone'),'') IS NULL THEN
    RAISE EXCEPTION 'INVALID_PARTNER_APPLICATION' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_application FROM public.partner_applications WHERE id=p_id;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'id',p_id,'duplicate',true); END IF;
  INSERT INTO public.partner_application_limits(phone_hash,window_started_at,request_count)
  VALUES(p_phone_hash,now(),1)
  ON CONFLICT(phone_hash) DO UPDATE SET
    window_started_at=CASE WHEN public.partner_application_limits.window_started_at<now()-interval '24 hours' THEN now() ELSE public.partner_application_limits.window_started_at END,
    request_count=CASE WHEN public.partner_application_limits.window_started_at<now()-interval '24 hours' THEN 1 ELSE public.partner_application_limits.request_count+1 END
  RETURNING request_count INTO v_count;
  IF v_count>5 THEN RAISE EXCEPTION 'PARTNER_APPLICATION_RATE_LIMIT' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.partner_applications(id,business_name,partner_type,contact_name,phone,branches_count,location_in_capital,notes,status)
  VALUES(p_id,left(btrim(p_payload->>'businessName'),120),left(btrim(COALESCE(p_payload->>'partnerType','')),80),
    left(btrim(p_payload->>'contactName'),120),left(btrim(p_payload->>'phone'),30),left(COALESCE(p_payload->>'branchesCount','1'),20),
    left(COALESCE(p_payload->>'locationInCapital',''),240),left(COALESCE(p_payload->>'notes',''),1000),'pending');
  RETURN jsonb_build_object('ok',true,'id',p_id,'duplicate',false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_sangoub_partner_application(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_sangoub_partner_application(text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_sangoub_partner(p_partner_id text,p_store jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_partner public.partner_applications%ROWTYPE; v_store public.stores%ROWTYPE;
BEGIN
  SELECT * INTO v_partner FROM public.partner_applications WHERE id=p_partner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_partner.store_id IS NOT NULL THEN
    SELECT * INTO v_store FROM public.stores WHERE id=v_partner.store_id;
    RETURN jsonb_build_object('ok',true,'storeId',v_partner.store_id,'alreadyApproved',true);
  END IF;
  IF NULLIF(p_store->>'id','') IS NULL OR NULLIF(btrim(p_store->>'name'),'') IS NULL
     OR COALESCE(p_store->>'status','') <> 'closed' THEN
    RAISE EXCEPTION 'INVALID_PARTNER_STORE' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.stores(id,name,name_en,type,category,logo,banner,status,delivery_time,min_order,delivery_fee,location_in_district,commission_rate,tax_rate)
  VALUES ((p_store->>'id')::uuid,left(btrim(p_store->>'name'),120),NULLIF(left(btrim(COALESCE(p_store->>'nameEn',p_store->>'name')),120),''),
    left(COALESCE(p_store->>'type','متجر'),80),COALESCE(NULLIF(p_store->>'category',''),'supermarket'),
    NULLIF(p_store->>'logo',''),NULLIF(p_store->>'banner',''),'closed',COALESCE(NULLIF(p_store->>'deliveryTime',''),'لم يحدد بعد'),
    COALESCE(NULLIF(p_store->>'minOrder','')::numeric,0),COALESCE(NULLIF(p_store->>'deliveryFee','')::numeric,0),
    left(COALESCE(p_store->>'locationInDistrict',v_partner.location_in_capital),240),10,0)
  RETURNING * INTO v_store;
  UPDATE public.partner_applications SET status='approved',store_id=v_store.id,updated_at=now() WHERE id=p_partner_id;
  INSERT INTO public.audit_logs(action,entity_type,entity_id,after_state,source)
    VALUES('partner.approved','partner_applications',p_partner_id,jsonb_build_object('storeId',v_store.id),'admin-data-api');
  RETURN jsonb_build_object('ok',true,'storeId',v_store.id,'alreadyApproved',false);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_sangoub_partner(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_sangoub_partner(text,jsonb) TO service_role;
