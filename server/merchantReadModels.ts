import { createHash } from 'node:crypto';
import { AdminError, validId } from './adminRequest.ts';
import { supabaseAdminClient } from './supabaseAdmin.ts';

export async function merchantReadModel(input: any, context: any) {
  const isAdmin = context.role === 'admin';
  const isMerchant = context.role === 'restaurant';
  const storeId = input.storeId || context.staff?.storeId;
  if (!isAdmin && !isMerchant) throw new AdminError(403, 'هذه الصفحة لموظفي الإدارة والمتجر فقط.');
  if (!storeId || (isMerchant && storeId !== context.staff?.storeId)) throw new AdminError(403, 'المتجر غير مرتبط بحسابك.');
  validId(storeId);

  const client = supabaseAdminClient();
  if (input.action === 'store-payments') {
    if (input.cursor !== undefined && (typeof input.cursor !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.cursor))) {
      throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
    }
    let query = client.from('merchant_settlements').select('id,store_id,gross,commission,net,reference,order_ids,created_at')
      .eq('store_id', storeId).order('created_at', { ascending: false }).limit(51);
    if (input.cursor) {
      const { data: cursorRow, error: cursorError } = await client.from('merchant_settlements')
        .select('created_at').eq('id', input.cursor).eq('store_id', storeId).maybeSingle();
      if (cursorError || !cursorRow) throw new AdminError(400, 'مؤشر الصفحة غير صالح.');
      query = query.lt('created_at', cursorRow.created_at);
    }
    const { data, error } = await query;
    if (error) throw new AdminError(503, 'تعذر قراءة تسويات المتجر من Supabase.');
    const rows = data || [];
    return {
      items: rows.slice(0, 50).map((row: any) => ({
        id: row.id, gross: Number(row.gross) || 0, commission: Number(row.commission) || 0,
        net: Number(row.net) || 0, reference: row.reference || '',
        orderCount: Array.isArray(row.order_ids) ? row.order_ids.length : 0, createdAt: row.created_at || null,
      })),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  }

  if (input.action !== 'store-customers') throw new AdminError(400, 'عملية بيانات المتجر غير معروفة.');
  const { data: orders, error } = await client.from('orders')
    .select('id,customer_id,customer_name,created_at')
    .contains('store_ids', [storeId])
    .order('created_at', { ascending: false })
    .limit(101);
  if (error) throw new AdminError(503, 'تعذر قراءة طلبات العملاء من Supabase.');
  const customers = new Map<string, any>();
  for (const order of (orders || []).slice(0, 100)) {
    if (!order.customer_id) continue;
    const id = createHash('sha256').update(storeId + '\0' + order.customer_id).digest('hex');
    const row = customers.get(id) || {
      id, name: typeof order.customer_name === 'string' ? order.customer_name.slice(0, 120) : 'عميل طلب', orderIds: [],
    };
    row.orderIds.push(order.id);
    customers.set(id, row);
  }
  return { items: [...customers.values()], truncated: (orders || []).length > 100 };
}
