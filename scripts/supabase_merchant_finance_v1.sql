-- Merchant settlement read model. Writes are performed by the server after
-- rechecking delivery, payment, contract rate, and duplicate claims.
CREATE TABLE IF NOT EXISTS public.merchant_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  store_name text NOT NULL,
  commission_rate numeric(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  gross numeric(12,2) NOT NULL CHECK (gross >= 0),
  commission numeric(12,2) NOT NULL CHECK (commission >= 0),
  net numeric(12,2) NOT NULL CHECK (net >= 0),
  reference text NOT NULL,
  order_ids uuid[] NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, reference)
);

CREATE TABLE IF NOT EXISTS public.merchant_settlement_claims (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  settlement_id uuid NOT NULL REFERENCES public.merchant_settlements(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, order_id)
);

CREATE INDEX IF NOT EXISTS merchant_settlements_store_created_idx
  ON public.merchant_settlements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_settlement_claims_settlement_idx
  ON public.merchant_settlement_claims(settlement_id);

ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlement_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_settlements, public.merchant_settlement_claims FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_settlements, public.merchant_settlement_claims TO service_role;

CREATE OR REPLACE FUNCTION public.save_sangoub_merchant_settlement(
  p_id uuid,
  p_store_id uuid,
  p_store_name text,
  p_commission_rate numeric,
  p_allocations jsonb,
  p_gross numeric,
  p_commission numeric,
  p_net numeric,
  p_reference text,
  p_order_ids uuid[],
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.merchant_settlements%ROWTYPE;
  v_count integer;
BEGIN
  IF p_id IS NULL OR p_store_id IS NULL OR p_actor_id IS NULL OR p_order_ids IS NULL
     OR cardinality(p_order_ids) < 1 OR cardinality(p_order_ids) > 100
     OR p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array'
     OR NULLIF(btrim(p_reference), '') IS NULL OR length(p_reference) > 200
     OR p_commission_rate < 0 OR p_commission_rate > 100
     OR p_gross < 0 OR p_commission < 0 OR p_net < 0 THEN
    RAISE EXCEPTION 'INVALID_SETTLEMENT_INPUT' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT u.order_id) FROM unnest(p_order_ids) AS u(order_id)) <> cardinality(p_order_ids) THEN
    RAISE EXCEPTION 'INVALID_SETTLEMENT_INPUT' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_record FROM public.merchant_settlements WHERE id=p_id FOR UPDATE;
  IF FOUND THEN
    IF v_record.store_id=p_store_id AND v_record.reference=btrim(p_reference)
       AND v_record.order_ids=p_order_ids AND v_record.gross=p_gross
       AND v_record.commission=p_commission AND v_record.net=p_net THEN
      RETURN to_jsonb(v_record);
    END IF;
    RAISE EXCEPTION 'SETTLEMENT_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.merchant_settlement_claims WHERE store_id=p_store_id AND order_id=ANY(p_order_ids)) THEN
    RAISE EXCEPTION 'SETTLEMENT_ALREADY_CLAIMED' USING ERRCODE = '23505';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.orders o
  WHERE o.id=ANY(p_order_ids) AND o.status='delivered' AND o.payment_status='paid'
    AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id=o.id AND i.store_id=p_store_id);
  IF v_count <> cardinality(p_order_ids) THEN
    RAISE EXCEPTION 'SETTLEMENT_ORDERS_CHANGED' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.merchant_settlements(
    id,store_id,store_name,commission_rate,allocations,gross,commission,net,reference,order_ids,actor_id
  ) VALUES (
    p_id,p_store_id,left(p_store_name,120),p_commission_rate,p_allocations,p_gross,p_commission,p_net,btrim(p_reference),p_order_ids,p_actor_id
  ) RETURNING * INTO v_record;

  INSERT INTO public.merchant_settlement_claims(store_id,order_id,settlement_id)
  SELECT p_store_id,u.order_id,p_id FROM unnest(p_order_ids) AS u(order_id);
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,after_state,source)
  VALUES(p_actor_id,'settlement.recorded','merchant_settlements',p_id::text,
    jsonb_build_object('storeId',p_store_id,'reference',btrim(p_reference),'gross',p_gross,'commission',p_commission,'net',p_net),
    'settlements-api');
  RETURN to_jsonb(v_record);
END;
$$;

REVOKE ALL ON FUNCTION public.save_sangoub_merchant_settlement(uuid,uuid,text,numeric,jsonb,numeric,numeric,numeric,text,uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_sangoub_merchant_settlement(uuid,uuid,text,numeric,jsonb,numeric,numeric,numeric,text,uuid[],uuid) TO service_role;
