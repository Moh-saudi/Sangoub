import { createHash } from 'node:crypto';
import { AdminError, validId } from './adminRequest.ts';
import { supabaseAdminClient } from './supabaseAdmin.ts';
import type { Order } from '../src/types';

const round = (n: number) => Math.round(n * 100) / 100;
export function settlementAmounts(order: Order, storeId: string, rate: number) {
  if (order.orderStatus !== 'delivered' || order.paymentStatus !== 'paid' || !Number.isFinite(rate) || rate < 0 || rate > 100)
    throw new AdminError(409, 'التسوية للطلبات المسلّمة والمدفوعة فقط وبنسبة تعاقد صحيحة.');
  const items = order.items.filter(item => item.product.storeId === storeId);
  if (!items.length) throw new AdminError(400, 'الطلب لا يخص المتجر.');
  const snapshot = order.storeSnapshots?.find(store => store.id === storeId);
  const itemTotal = items.reduce((total, item) => total + (item.product.price + item.extraPrice) * item.quantity, 0);
  const discount = snapshot?.discount ?? (order.subtotal > 0 ? ((order.discount || 0) * itemTotal) / order.subtotal : 0);
  const netProducts = round((snapshot?.subtotal ?? itemTotal) - discount);
  const gross = round(netProducts + (snapshot?.additionalTax || 0));
  const basis = round(Math.max(0, netProducts - (snapshot?.includedTax || 0)));
  if (![gross, basis].every(Number.isFinite) || gross < 0) throw new AdminError(409, 'بيانات مالية غير صالحة؛ راجع الطلب.');
  const commission = round((basis * rate) / 100);
  return { orderId: order.id, gross, basis, commission, net: round(gross - commission), rate };
}

export async function settlementAction(input: any, context: any) {
  const client = supabaseAdminClient();
  if (input.action === 'settlement-list') {
    const { data, error } = await client.from('merchant_settlements')
      .select('id,store_id,store_name,commission_rate,allocations,gross,commission,net,reference,order_ids,actor_id,created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw new AdminError(503, 'تعذر قراءة التسويات من Supabase.');
    return { records: (data || []).map((row: any) => ({ ...row, createdAt: row.created_at })) };
  }

  validId(input.storeId);
  if (!Array.isArray(input.orderIds) || !input.orderIds.length || input.orderIds.length > 100 || new Set(input.orderIds).size !== input.orderIds.length)
    throw new AdminError(400, 'اختر حتى 100 طلب مختلف للتسوية.');
  input.orderIds.forEach(validId);
  const save = input.action === 'settlement-save';
  if (!save && input.action !== 'settlement-preview') throw new AdminError(400, 'عملية تسوية غير معروفة.');
  if (save) {
    validId(input.id);
    if (typeof input.reference !== 'string' || !input.reference.trim() || input.reference.length > 200) throw new AdminError(400, 'اكتب مرجع التحويل الفعلي.');
  }

  const [{ data: store, error: storeError }, { data: rows, error: ordersError }] = await Promise.all([
    client.from('stores').select('id,name,commission_rate').eq('id', input.storeId).maybeSingle(),
    client.from('orders').select('id,status,subtotal,discount,payment_status,order_items(id,store_id,product_name,price,quantity,extra_price)')
      .in('id', input.orderIds),
  ]);
  if (storeError || ordersError) throw new AdminError(503, 'تعذر تحميل بيانات التسوية من Supabase.');
  const rate = Number(store?.commission_rate);
  if (!store || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new AdminError(409, 'سجّل نسبة التعاقد الصحيحة للمتجر قبل التسوية.');
  if ((rows || []).length !== input.orderIds.length) throw new AdminError(404, 'أحد الطلبات غير موجود.');

  const allocations = (rows || []).map((row: any) => {
    const order: Order = {
      id: row.id, orderStatus: row.status, paymentStatus: row.payment_status,
      subtotal: Number(row.subtotal) || 0, discount: Number(row.discount) || 0,
      items: (row.order_items || []).map((item: any) => ({
        id: item.id, quantity: Number(item.quantity) || 0, extraPrice: Number(item.extra_price) || 0,
        selectedOptions: {}, product: { id: item.id, storeId: item.store_id, name: item.product_name, price: Number(item.price) || 0 },
      })),
    } as Order;
    return settlementAmounts(order, input.storeId, rate);
  });
  const quote = {
    storeId: input.storeId, storeName: store.name, commissionRate: rate, allocations,
    gross: round(allocations.reduce((sum, allocation) => sum + allocation.gross, 0)),
    commission: round(allocations.reduce((sum, allocation) => sum + allocation.commission, 0)),
    net: round(allocations.reduce((sum, allocation) => sum + allocation.net, 0)),
  };
  const quoteHash = createHash('sha256').update(JSON.stringify(quote)).digest('hex');
  if (!save) return { quote, quoteHash };
  if (input.quoteHash !== quoteHash) throw new AdminError(409, 'تغيرت بيانات التسوية. راجع المبلغ مجددًا.');

  const { data, error } = await client.rpc('save_sangoub_merchant_settlement', {
    p_id: input.id, p_store_id: input.storeId, p_store_name: store.name, p_commission_rate: rate,
    p_allocations: allocations, p_gross: quote.gross, p_commission: quote.commission, p_net: quote.net,
    p_reference: input.reference.trim(), p_order_ids: input.orderIds, p_actor_id: context.actor.uid,
  });
  if (error) {
    if (error.message?.includes('SETTLEMENT_ALREADY_CLAIMED') || error.code === '23505') throw new AdminError(409, 'مرجع العملية مستخدم أو تمت تسوية أحد الطلبات من قبل.');
    throw new AdminError(503, 'تعذر حفظ التسوية في Supabase.');
  }
  return { record: data };
}
