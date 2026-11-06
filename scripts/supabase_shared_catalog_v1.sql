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
