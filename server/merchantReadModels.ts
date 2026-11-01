import {readQuery} from './data/firestoreQueries.ts';
import {queryPlans} from '../src/data/queryPlans.ts';
import {createHash} from 'node:crypto';
import {AdminError,validId} from './adminRequest.ts';

export async function merchantReadModel(input: any, context: any) {
  const { db, staff, actor, role } = context;
  const storeId = input.storeId || staff?.storeId || 'store-foul-hind';
  validId(storeId);
  const isAdmin = role === 'admin';
  const isMerchant = role === 'restaurant' || staff?.role === 'restaurant';
  if (!isAdmin && !isMerchant) {
    throw new AdminError(403, 'هذه الصفحة لمدير المتجر فقط.');
  }
  const access = await db.doc('accountAccess/' + actor.uid).get();
  const control = access.data();
  const revokedSec = control?.revokedBefore ? (control.revokedBefore > 1e11 ? Math.floor(control.revokedBefore / 1000) : control.revokedBefore) : 0;
  if (control?.disabled === true || control?.operationLocked === true || (revokedSec > 0 && actor.auth_time <= revokedSec)) {
    throw new AdminError(403, 'انتهت صلاحية الحساب.');
  }

  if (input.action === 'store-payments') {
    if (input.cursor) validId(input.cursor);
    const snapshot = await readQuery(db, queryPlans.merchantPayments(storeId), input.cursor || undefined);
    const docs = snapshot.docs.slice(0, 50);
    return {
      items: docs.map((d: any) => {
        const v = d.data();
        return {
          id: d.id,
          gross: v.gross,
          commission: v.commission,
          net: v.net,
          reference: v.reference || '',
          orderCount: Array.isArray(v.orderIds) ? v.orderIds.length : 0,
          createdAt: v.createdAt?.toDate?.().toISOString() || null
        };
      }),
      nextCursor: snapshot.docs.length > 50 ? docs.at(-1)!.id : null
    };
  }

  const snapshot = await readQuery(db, queryPlans.merchantCustomers(storeId));
  const customers = new Map<string, any>();
  for (const d of snapshot.docs.slice(0, 100)) {
    const order = d.data();
    if (!order.profileId) continue;
    const id = createHash('sha256').update(storeId + '\0' + order.profileId).digest('hex');
    const row = customers.get(id) || { id, name: typeof order.profileName === 'string' ? order.profileName.slice(0, 120) : 'عميل طلب', orderIds: [] };
    row.orderIds.push(d.id);
    customers.set(id, row);
  }
  return { items: [...customers.values()], truncated: snapshot.docs.length > 100 };
}
