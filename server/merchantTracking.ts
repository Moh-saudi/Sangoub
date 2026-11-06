import { supabaseAdminClient } from './supabaseAdmin.ts';
import { AdminError, validId } from './adminRequest.ts';
import type { OperationIdentity } from './operations.ts';

export async function merchantTracking(input: any, context: OperationIdentity) {
  validId(input.orderId);
  if (!context.verified || context.role !== 'restaurant' || !context.staff?.storeId)
    throw new AdminError(403, 'هذه المتابعة لحساب المتجر المعتمد فقط.');
  const storeId = context.staff.storeId;
  const client = supabaseAdminClient();
  const { data: order, error } = await client.from('orders')
    .select('id,status,courier_id,store_id,store_ids')
    .eq('id', input.orderId).maybeSingle();
  if (error) throw new AdminError(503, 'تعذر قراءة الطلب من Supabase.');
  if (!order || (order.store_id !== storeId && !(order.store_ids || []).includes(storeId)))
    throw new AdminError(404, 'الطلب غير متاح لهذا المتجر.');
  const orderStatus = order.status === 'assigned' || order.status === 'picked_up' ? 'with_courier'
    : order.status === 'pending' || order.status === 'accepted' ? 'received' : order.status;
  if (orderStatus !== 'with_courier' || !order.courier_id) return { orderStatus, tracking: null };
  const { data: location, error: locationError } = await client.from('courier_locations')
    .select('latitude,longitude,is_online,updated_at').eq('courier_id', order.courier_id).maybeSingle();
  if (locationError) throw new AdminError(503, 'تعذر تحميل موقع المندوب من Supabase.');
  const coordinates = location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180
    ? { latitude: location.latitude, longitude: location.longitude } : null;
  return { orderStatus, tracking: coordinates ? { coordinates, active: location!.is_online === true, updatedAt: location!.updated_at } : null };
}
