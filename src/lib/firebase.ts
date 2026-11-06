import { adminApi } from './adminApi';
import type { Order } from '../types/index.ts';

/** Compatibility name retained for callers while catalog data is owned by Supabase. */
export const cleanData = <T>(data: T): T => JSON.parse(JSON.stringify(data));

export async function saveRecord(collection: string, id: string, data: object) {
  if (collection === 'partnerApplications') {
    throw new Error('استخدم نقطة تسجيل طلب الشراكة العامة.');
  }
  return adminApi('data', { action: 'save', collection, id, data: cleanData(data) });
}

export async function deleteRecord(collection: string, id: string) {
  return adminApi('data', { action: 'delete', collection, id });
}

export async function updateOrderRecord(id: string, changes: Partial<Order>) {
  return adminApi('data', { action: 'save', collection: 'orders', id, data: cleanData(changes) });
}

export async function approvePartner(partnerId: string, store: import('../types/index.ts').Store) {
  return adminApi('data', { action: 'approve', collection: 'partnerApplications', id: partnerId, store: cleanData(store) });
}
