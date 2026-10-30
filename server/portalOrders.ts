import {readQuery} from './data/firestoreQueries.ts';
import {queryPlans} from '../src/data/queryPlans.ts';
import { courierApprovalError } from '../src/validation/accounts.ts';
import { FieldValue } from 'firebase-admin/firestore';
import { AdminError, validId } from './adminRequest.ts';
import { activeOrderStatuses, writeOrderSignals } from './orderSignals.ts';
import { auditSafe, auditInTransaction } from './audit.ts';
import { paymentReady, requireOperationalAccess, type OperationIdentity } from './operations.ts';
const fields = (value: any, keys: string[]) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, value[k]]));
export function portalItems(items: any[], storeId?: string): any[] {
  return (items || []).filter(i => !storeId || i.product?.storeId === storeId).map(i => ({
    ...fields(i, ['id', 'quantity', 'selectedOptions', 'extraPrice', 'notes']),
    product: fields(i.product, ['id', 'storeId', 'storeName', 'name', 'price', 'imageUrl', 'imageType', 'category'])
  }));
}
export function merchantOrderView(id: string, order: any, storeId: string) {
  const items = portalItems(order.items, storeId);
  const subtotal = items.reduce((n, i) => n + (Number(i.product.price) + Number(i.extraPrice || 0)) * Number(i.quantity), 0);
  // Explicit allowlist: never spread the parent order, other snapshots or financial metadata.
  return auditSafe({
    id,
    ...fields(order, ['orderNumber', 'orderStatus', 'fulfillmentVersion', 'createdAt', 'updatedAt', 'readyAt', 'deliveredAt', 'paymentMethod']),
    items,
    storeIds: [storeId],
    kitchenStatus: {
      [storeId]: order.kitchenStatus?.[storeId] || 'received'
    },
    subtotal,
    total: subtotal,
    discount: 0,
    deliveryFee: 0,
    tip: 0,
    paymentReady: paymentReady(order),
    paymentStatus: order.paymentStatus || 'pending',
    courierName: order.courierName || '',
    courierPhone: order.courierPhone || ''
  });
}
export function courierOrderView(id: string, order: any) {
  return auditSafe({
    id,
    ...fields(order, ['orderNumber', 'orderStatus', 'courierId', 'profileId', 'fulfillmentVersion', 'profileName', 'phone', 'ministry', 'floorNumber', 'roomNumber', 'coordinates', 'createdAt', 'updatedAt', 'deliveredAt', 'paymentMethod', 'paymentStatus']),
    items: portalItems(order.items),
    storeIds: order.storeIds || [],
    total: order.total,
    amountToCollect: order.paymentMethod === 'cash' ? order.total : 0,
    received: order.courierChecklist?.receivedAndCheckedAtRestaurant === true
  });
}
export const portalOrderActions = ['portal-active', 'portal-history', 'courier-pickup', 'courier-depart'];
export async function portalOrders(input: any, context: OperationIdentity) {
  requireOperationalAccess(context);
  const {
    db,
    actor,
    role,
    staff
  } = context;
  if (!['restaurant', 'courier'].includes(role)) throw new AdminError(403, 'بوابة التشغيل لفريق المتجر والمندوب فقط.');
  if (role === 'restaurant') validId(staff?.storeId);
  if (input.action === 'portal-active' || input.action === 'portal-history') {
    const history = input.action === 'portal-history';
    if (input.cursor) {
      if (!history) throw new AdminError(400, 'المؤشر للسجل فقط.');
      validId(input.cursor);
    }
    const snapshot = await readQuery(db,queryPlans.portalOrders(role==='restaurant'?'store':'courier',role==='restaurant'?staff!.storeId:actor.uid,history?['delivered','cancelled']:activeOrderStatuses,history),input.cursor||undefined),
      docs = snapshot.docs.slice(0, history ? 20 : 50);
    const items = [];
    const storeCache = new Map<string, Promise<any>>();
    for (const d of docs) {
      // A read inside the bootstrap transaction prevents an old response resurrecting an ended/reassigned signal.
      const order = await db.runTransaction(async tx => {
        const fresh = await tx.get(d.ref);
        const o = fresh.data();
        if (!o || (role === 'courier' ? o.courierId !== actor.uid : !o.storeIds?.includes(staff!.storeId))) return null;
        if (!history) {
          const signalRef = db.doc(`${role === 'restaurant' ? 'storeOrderSignals/' + staff!.storeId : 'courierOrderSignals/' + actor.uid}/orders/${d.id}`);
          const signal = await tx.get(signalRef),
            active = activeOrderStatuses.includes(o.orderStatus);
          if (!signal.exists || signal.data()?.active !== active || signal.data()?.orderStatus !== o.orderStatus) writeOrderSignals(db, tx, {
            ...o,
            id: d.id
          });
          if (!active) return null;
        }
        return o;
      });
      if (!order) continue;
      const view = role === 'restaurant' ? merchantOrderView(d.id, order, staff!.storeId) : history ? auditSafe({id:d.id,...fields(order,['orderNumber','orderStatus','total','paymentMethod','deliveredAt'])}) : courierOrderView(d.id, order);
      if (role === 'restaurant' && order.fulfillmentVersion === 2) {
        const ticket = await db.doc(`orders/${d.id}/fulfillments/${staff!.storeId}`).get();
        if (!ticket.exists) continue;
        view.kitchenStatus = {
          [staff!.storeId]: ticket.data()!.status
        };
        view.issueOpen = ticket.data()!.issueOpen === true;
      }
      if (role === 'courier' && !history) {
        view.pickupPoints = await Promise.all((order.storeIds || []).map(async (storeId: string) => {
          if (!storeCache.has(storeId)) storeCache.set(storeId, db.doc('stores/' + storeId).get());
          const store = await storeCache.get(storeId);
          return {
            storeId,
            name: store?.data()?.name || order.items.find((i: any) => i.product.storeId === storeId)?.product.storeName || 'المتجر',
            address: store?.data()?.locationInDistrict || 'راجع عنوان الاستلام مع الإدارة'
          };
        }));
      }
      if (role === 'courier' && order.fulfillmentVersion === 2) {
        const tickets = await Promise.all((order.storeIds || []).map((s: string) => db.doc(`orders/${d.id}/fulfillments/${s}`).get()));
        view.stops = tickets.filter(t => t.exists).map(t => auditSafe({
          ...fields(t.data(), ['storeId', 'storeName', 'status', 'issueOpen']),
          items: portalItems(t.data()!.items, t.data()!.storeId)
        }));
      }
      items.push(view);
    }
    return {
      items,
      nextCursor: history && snapshot.size > 20 ? docs.at(-1)?.id : null,
      truncated: !history && snapshot.size > 50
    };
  }
  if (role !== 'courier') throw new AdminError(403, 'العملية للمندوب فقط.');
  validId(input.orderId);
  return db.runTransaction(async tx => {
    const ref = db.doc('orders/' + input.orderId);
    const [record, membership, access, profile] = await Promise.all([tx.get(ref), tx.get(db.doc('staff/' + actor.uid)), tx.get(db.doc('accountAccess/' + actor.uid)),tx.get(db.doc('users/'+actor.uid))]);
    const o = record.data(),
      a = access.data();
    if (membership.data()?.role !== 'courier' || (membership.data()?.courierStatus&&membership.data()?.courierStatus!=='active') || a?.disabled || a?.operationLocked || actor.auth_time <= (a?.revokedBefore || 0)) throw new AdminError(403, 'انتهت صلاحية الحساب.');
    const approvalError=courierApprovalError(membership.data(),profile.data());if(approvalError)throw new AdminError(403,approvalError);
    if (!o || o.courierId !== actor.uid) throw new AdminError(403, 'المهمة ليست مسندة إليك.');
    if (o.fulfillmentVersion === 2) throw new AdminError(409, 'استخدم إجراءات نقاط الاستلام لهذا الطلب.');
    if (!paymentReady(o) || !['ready', 'with_courier'].includes(o.orderStatus)) throw new AdminError(409, 'الطلب غير جاهز للاستلام أو التوصيل.');
    if (input.action === 'courier-pickup' && input.confirmed !== true) throw new AdminError(400, 'أكد مراجعة الأصناف والكميات.');
    if (input.action === 'courier-depart' && !o.courierChecklist?.receivedAndCheckedAtRestaurant) throw new AdminError(409, 'أكد الاستلام أولاً.');
    if (o.orderStatus === 'with_courier' || input.action === 'courier-pickup' && o.courierChecklist?.receivedAndCheckedAtRestaurant) return {
      ok: true
    };
    const patch = input.action === 'courier-pickup' ? {
      courierChecklist: {
        ...o.courierChecklist,
        receivedAndCheckedAtRestaurant: true
      }
    } : {
      orderStatus: 'with_courier',
      departedAt: FieldValue.serverTimestamp()
    };
    tx.update(ref, {
      ...patch,
      updatedAt: FieldValue.serverTimestamp()
    });
    writeOrderSignals(db, tx, {
      ...o,
      ...patch,
      id: input.orderId
    }, o);
    auditInTransaction(db, tx, actor, input.action, 'orders', input.orderId, {
      orderStatus: o.orderStatus
    }, patch);
    return {
      ok: true
    };
  });
}
