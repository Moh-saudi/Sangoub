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
