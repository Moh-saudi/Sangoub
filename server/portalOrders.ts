import { courierApprovalError } from '../src/validation/accounts.ts';
import { AdminError, validId } from './adminRequest.ts';
import { supabaseAdminClient } from './supabaseAdmin.ts';
import { requireOperationalAccess, type OperationIdentity } from './operations.ts';

export const portalOrderActions = ['portal-active','portal-history','courier-pickup','courier-depart'];
const terminalStatuses = ['delivered','cancelled'];
const appStatus = (status: string) => status === 'assigned' || status === 'picked_up' ? 'with_courier'
  : status === 'pending' || status === 'accepted' ? 'received' : status;
const paymentReady = (order: any) => order.payment_method === 'cash' || (order.payment_status === 'paid' && Boolean(order.payment_confirmed_at));

function itemView(item: any, productImgMap?: Map<string, string>) {
  const pId = item?.product?.id || item?.product_id;
  const img = (pId && productImgMap?.get(pId)) || item?.product?.imageUrl || item?.imageUrl || item?.image_url;
  if (item?.product) return {
    id: item.id, quantity: Number(item.quantity) || 1, selectedOptions: item.selectedOptions || {},
    extraPrice: Number(item.extraPrice) || 0, notes: item.notes || '', product: {
      id: item.product.id, storeId: item.product.storeId, name: item.product.name, price: Number(item.product.price) || 0,
      imageUrl: img,
    },
  };
  return {
    id: item.id,
    quantity: Number(item.quantity) || 1,
    selectedOptions: item.selected_options || {},
    extraPrice: Number(item.extra_price) || 0,
    notes: item.notes || '',
    product: { id: item.product_id, storeId: item.store_id, name: item.product_name, price: Number(item.price) || 0, imageUrl: img },
  };
}

const pick = (value: any, keys: string[]) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
export function merchantOrderView(id: string, order: any, storeId: string) {
  const items = (order.items || []).filter((item: any) => item.product?.storeId === storeId).map((item: any) => ({
    ...pick(item, ['id','quantity','selectedOptions','extraPrice','notes']),
    product: pick(item.product, ['id','storeId','storeName','name','price','imageUrl','imageType','category']),
  }));
  const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.product.price) + Number(item.extraPrice || 0)) * Number(item.quantity), 0);
  return {
    id, ...pick(order, ['orderNumber','orderStatus','fulfillmentVersion','createdAt','updatedAt','readyAt','deliveredAt','paymentMethod']), items,
    storeIds: [storeId], kitchenStatus: { [storeId]: order.kitchenStatus?.[storeId] || 'received' }, subtotal, total: subtotal,
    discount: 0, deliveryFee: 0, tip: 0, paymentReady: paymentReady({ payment_method: order.paymentMethod, payment_status: order.paymentStatus, payment_confirmed_at: order.paymentConfirmedAt }),
    paymentStatus: order.paymentStatus || 'pending', courierName: order.courierName || '', courierPhone: order.courierPhone || '',
  };
}

export async function portalOrders(input: any, context: OperationIdentity) {
  requireOperationalAccess(context);
  const { actor, role, staff } = context;
  if (!['restaurant','courier'].includes(role)) throw new AdminError(403, 'بوابة التشغيل لفريق المتجر والمندوب فقط.');
  const storeId = staff?.storeId;
  if (role === 'restaurant' && !storeId) throw new AdminError(403, 'حساب المتجر غير مرتبط بفرع بعد.');

  if (input.action === 'portal-active' || input.action === 'portal-history') {
    const history = input.action === 'portal-history';
    if (input.cursor !== undefined && (typeof input.cursor !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.cursor))) throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
    const client = supabaseAdminClient();
    let query = client.from('orders').select('*,order_items(*),stores(name,location_in_district)');
    if (role === 'courier') query = query.eq('courier_id', actor.uid);
    else query = query.or(`store_id.eq.${storeId},store_ids.cs.{${storeId}}`);
    query = history ? query.in('status', terminalStatuses) : query.not('status','in','(delivered,cancelled)');
    if (input.cursor) {
      const { data: cursorOrder } = await client.from('orders').select('created_at').eq('id', input.cursor).maybeSingle();
      if (!cursorOrder) throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
      query = query.lt('created_at', cursorOrder.created_at);
    }
    const pageSize = history ? 20 : 50;
    const { data: rows, error } = await query.order('created_at', { ascending: false }).limit(pageSize + 1);
    if (error) throw new AdminError(503, 'تعذر تحميل مهام Supabase.');
    const orders = (rows || []).slice(0, pageSize);
    const ids = orders.map((order: any) => order.id);
    const fulfillmentsByOrder = new Map<string, any[]>();
    if (ids.length && role === 'restaurant' && !history) {
      const { data, error: ticketsError } = await client.from('order_fulfillments').select('*').in('order_id', ids).eq('store_id', storeId);
      if (ticketsError) throw new AdminError(503, 'تعذر تحميل تذاكر التحضير من Supabase.');
      for (const ticket of data || []) fulfillmentsByOrder.set(ticket.order_id, [ticket]);
    }
    const allStoreIds = [...new Set<string>(orders.flatMap((order: any) => order.store_ids || [order.store_id]).filter((id: string) => /^[0-9a-f-]{36}$/i.test(id)))];
    const storeById = new Map<string, any>();
    if (role === 'courier' && !history && allStoreIds.length) {
      const { data, error: storesError } = await client.from('stores').select('id,name,location_in_district').in('id', allStoreIds);
      if (storesError) throw new AdminError(503, 'تعذر تحميل نقاط الاستلام.');
      for (const store of data || []) storeById.set(store.id, store);
      const { data: tickets, error: ticketsError } = await client.from('order_fulfillments').select('*').in('order_id', ids);
      if (ticketsError) throw new AdminError(503, 'تعذر تحميل تذاكر نقاط الاستلام.');
      for (const ticket of tickets || []) fulfillmentsByOrder.set(ticket.order_id, [...(fulfillmentsByOrder.get(ticket.order_id) || []), ticket]);
    }

    const allProductIds = [...new Set<string>(orders.flatMap((order: any) => (order.order_items || []).map((i: any) => i.product_id)).filter(Boolean))];
    const productImgMap = new Map<string, string>();
    if (allProductIds.length) {
      const { data: prods } = await client.from('products').select('id,image_url').in('id', allProductIds);
      for (const p of prods || []) {
        if (p.id && p.image_url) productImgMap.set(p.id, p.image_url);
      }
    }

    const items = orders.flatMap((order: any) => {
      const status = appStatus(order.status);
      const common = { id: order.id, orderNumber: order.order_number || order.id, orderStatus: status, createdAt: order.created_at, updatedAt: order.updated_at, paymentMethod: order.payment_method, paymentStatus: order.payment_status };
      if (history) return [{ ...common, ...(role === 'courier' ? { total: Number(order.total_amount) || 0, deliveredAt: order.delivered_at } : {}) }];
      if (role === 'restaurant') {
        const ticket = fulfillmentsByOrder.get(order.id)?.[0];
        if (!ticket) return [];
        const ticketItems = (ticket.items || []).map((item: any) => ({ ...item, product: { ...item.product } }));
        const subtotal = ticketItems.reduce((sum: number, item: any) => sum + (Number(item.product?.price) + Number(item.extraPrice || 0)) * Number(item.quantity || 0), 0);
        return [{
          ...common, fulfillmentVersion: 2, items: ticketItems, storeIds: [storeId], kitchenStatus: { [storeId!]: ticket.status },
          subtotal, total: subtotal, discount: 0, deliveryFee: 0, tip: 0,
          paymentReady: paymentReady(order), issueOpen: ticket.issue_open === true,
          paymentStatus: order.payment_status, courierName: order.courier_name || '', courierPhone: order.courier_phone || '',
        }];
      }
      const storeIds: string[] = order.store_ids || [order.store_id];
      const stops = (fulfillmentsByOrder.get(order.id) || []).map(ticket => ({
        storeId: ticket.store_id, storeName: storeById.get(ticket.store_id)?.name || 'المتجر', status: ticket.status, issueOpen: ticket.issue_open,
        items: (ticket.items || []).map(i => itemView(i, productImgMap)),
      }));
      return [{
        ...common, courierId: order.courier_id, fulfillmentVersion: 2, profileId: order.customer_id, profileName: order.customer_name || '',
        phone: order.customer_phone || '', ministry: order.delivery_ministry || '', floorNumber: order.delivery_floor || '', roomNumber: order.delivery_room || '',
        coordinates: order.coordinates || (order.delivery_lat && order.delivery_lng ? { latitude: order.delivery_lat, longitude: order.delivery_lng } : undefined),
        items: (order.order_items || []).map(i => itemView(i, productImgMap)), storeIds, total: Number(order.total_amount) || 0,
        amountToCollect: order.payment_method === 'cash' ? Number(order.total_amount) || 0 : 0,
        pickupPoints: storeIds.map(id => ({ storeId: id, name: storeById.get(id)?.name || 'المتجر', address: storeById.get(id)?.location_in_district || 'راجع عنوان الاستلام مع الإدارة' })),
        stops, received: Array.isArray(order.picked_up_store_ids) && storeIds.every(id => order.picked_up_store_ids.includes(id)),
      }];
    });
    return { items, nextCursor: (rows || []).length > pageSize ? orders.at(-1)?.id || null : null, truncated: !history && (rows || []).length > pageSize };
  }

  if (role !== 'courier') throw new AdminError(403, 'العملية للمندوب فقط.');
  validId(input.orderId);
  if (!/^[0-9a-f-]{36}$/i.test(input.orderId)) throw new AdminError(400, 'معرّف الطلب غير صالح.');
  const approvalError = courierApprovalError({ courierStatus: context.profile?.courier_status }, context.profile);
  if (approvalError) throw new AdminError(403, approvalError);
  const client = supabaseAdminClient();
  if (input.action === 'courier-pickup') {
    if (input.confirmed !== true) throw new AdminError(400, 'أكد مراجعة الأصناف والكميات.');
    validId(input.storeId);
    if (!/^[0-9a-f-]{36}$/i.test(input.storeId)) throw new AdminError(400, 'معرّف المتجر غير صالح.');
    const { data, error } = await client.rpc('pickup_sangoub_order_store', { p_order_id: input.orderId, p_store_id: input.storeId, p_courier_id: actor.uid });
    if (error) throw new AdminError(503, 'تعذر تأكيد الاستلام في Supabase.');
    if (data?.status !== 200) throw new AdminError(Number(data?.status) || 409, data?.error === 'STORE_NOT_READY' ? 'المتجر لم يؤكد جاهزية الأصناف.' : 'تعذر تأكيد استلام نقطة التوصيل.');
    return { ok: true };
  }
  if (input.action === 'courier-depart') {
    const { data, error } = await client.rpc('depart_sangoub_order', { p_order_id: input.orderId, p_courier_id: actor.uid });
    if (error) throw new AdminError(503, 'تعذر بدء التوصيل في Supabase.');
    if (data?.status !== 200) throw new AdminError(Number(data?.status) || 409, 'أكد استلام الطلب من جميع المتاجر قبل بدء التوصيل.');
    return { ok: true };
  }
  throw new AdminError(400, 'عملية بوابة غير معروفة.');
}
