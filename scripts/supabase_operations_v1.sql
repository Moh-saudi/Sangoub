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
