import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
export const activeOrderStatuses = ['received', 'preparing', 'ready', 'with_courier'];
/** Invalidation only. Never copy customer details, items, totals or provider metadata. */
export function writeOrderSignals(db: Firestore, tx: Transaction, order: any, before: any = null) {
  const active = activeOrderStatuses.includes(order.orderStatus);
  for (const storeId of new Set<string>([...(before?.storeIds || []), ...(order.storeIds || [])])) {
    tx.set(db.doc(`storeOrderSignals/${storeId}/orders/${order.id}`), {
      orderId: order.id,
      storeId,
      active: active && (order.storeIds || []).includes(storeId),
      orderStatus: order.orderStatus,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  for (const courierId of new Set<string>([before?.courierId, order.courierId].filter(Boolean))) {
    tx.set(db.doc(`courierOrderSignals/${courierId}/orders/${order.id}`), {
      orderId: order.id,
      courierId,
      active: active && order.courierId === courierId,
      orderStatus: order.orderStatus,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
}
