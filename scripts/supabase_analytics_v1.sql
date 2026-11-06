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
