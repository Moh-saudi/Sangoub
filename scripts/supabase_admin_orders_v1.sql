CREATE OR REPLACE FUNCTION public.admin_update_sangoub_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_order_status text DEFAULT NULL,
  p_courier_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_courier public.profiles%ROWTYPE;
  v_before_status text;
  v_before_courier uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  v_before_status:=v_order.status;
  v_before_courier:=v_order.courier_id;
  IF p_order_status IS NULL AND p_courier_id IS NULL THEN RAISE EXCEPTION 'EMPTY_ORDER_CHANGE' USING ERRCODE='22023'; END IF;
  IF p_order_status IS NOT NULL AND p_order_status <> 'cancelled' THEN RAISE EXCEPTION 'ADMIN_ORDER_STATUS_RESTRICTED' USING ERRCODE='23514'; END IF;
  IF p_order_status='cancelled' AND p_courier_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_ORDER_CHANGE' USING ERRCODE='22023'; END IF;

  IF p_courier_id IS NOT NULL THEN
    IF v_order.status <> 'ready' OR NOT (v_order.payment_method='cash' OR (v_order.payment_status='paid' AND v_order.payment_confirmed_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'ORDER_NOT_READY_FOR_ASSIGNMENT' USING ERRCODE='23514';
    END IF;
    IF v_order.fulfillment_version=2 AND (
      NOT EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id)
      OR EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND (status<>'ready' OR issue_open))
    ) THEN RAISE EXCEPTION 'FULFILLMENT_NOT_READY' USING ERRCODE='23514'; END IF;
    SELECT * INTO v_courier FROM public.profiles WHERE id=p_courier_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'COURIER_PROFILE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    UPDATE public.orders SET courier_id=p_courier_id,courier_name=v_courier.full_name,courier_phone=v_courier.phone,updated_at=now()
      WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  IF p_order_status='cancelled' THEN
    IF v_order.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'ORDER_ALREADY_CLOSED' USING ERRCODE='23514'; END IF;
    IF v_order.payment_method<>'cash' AND v_order.payment_status='paid' THEN RAISE EXCEPTION 'PAID_ORDER_REFUND_REQUIRED' USING ERRCODE='23514'; END IF;
    IF v_order.fulfillment_version=2 THEN
      IF EXISTS (SELECT 1 FROM public.order_fulfillments WHERE order_id=p_order_id AND status='picked_up') THEN
        RAISE EXCEPTION 'ORDER_ITEMS_ALREADY_PICKED_UP' USING ERRCODE='23514';
      END IF;
      UPDATE public.order_fulfillments SET status='cancelled',updated_at=now() WHERE order_id=p_order_id AND status<>'cancelled';
    END IF;
    UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;

  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,before_state,after_state,source)
  VALUES(p_actor_id,CASE WHEN p_order_status='cancelled' THEN 'orders.cancelled' ELSE 'orders.courier.assigned' END,
    'orders',p_order_id::text,jsonb_build_object('status',v_before_status,'courier_id',v_before_courier),
    jsonb_build_object('status',v_order.status,'courier_id',v_order.courier_id),'admin-data-api');
  RETURN jsonb_build_object('id',v_order.id,'status',v_order.status,'courier_id',v_order.courier_id,
    'courier_name',v_order.courier_name,'courier_phone',v_order.courier_phone,'updated_at',v_order.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_sangoub_order(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sangoub_order(uuid,uuid,text,uuid) TO service_role;
