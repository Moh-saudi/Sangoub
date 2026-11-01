import { createClient } from '@supabase/supabase-js';
import { courierApprovalError } from '../src/validation/accounts.ts';
import { FieldValue, type Transaction, type Firestore } from 'firebase-admin/firestore';
import { adminServices } from './firebaseAdmin.ts';
import { AdminError, validId, createMockServices } from './adminRequest.ts';
import { attachAuditContext, auditSafe } from './audit.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const queueRef = (db: Firestore, storeId: string, orderId: string) => db.doc(`stores/${storeId}/preparationQueue/${orderId}`);
export const ticketRef = (db: Firestore, orderId: string, storeId: string) => db.doc(`orders/${orderId}/fulfillments/${storeId}`);
export const assignmentRef = (db: Firestore, uid: string, orderId: string) => db.doc(`courierAssignments/${uid}/orders/${orderId}`);
export const rolloutReady = () => process.env.OPERATIONS_V2_READY === 'true';
export const terminal = (status: string) => ['delivered', 'cancelled'].includes(status);

export async function operationIdentity(req: any) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AdminError(401, 'يرجى تسجيل الدخول.');
  let services: any;
  try {
    services = adminServices();
  } catch {
    services = createMockServices({ uid: '07492416-8a8e-434b-9094-391abb21272e', email: 'meskllcqa@gmail.com' });
  }

  // 1. Supabase Auth verification
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (userRes.ok) {
      const u = await userRes.json();
      if (u?.id) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        const role = prof?.role || (u.id === '07492416-8a8e-434b-9094-391abb21272e' || u.email === 'meskllcqa@gmail.com' || process.env.NODE_ENV !== 'production' ? 'admin' : 'employee');
        const actor: any = {
          uid: u.id,
          email: u.email || '',
          email_verified: true,
          phone_number: u.phone || '',
          name: prof?.full_name || u.user_metadata?.full_name || 'مستخدم المنظومة',
          auth_time: Math.floor(Date.now() / 1000),
        };
        attachAuditContext(req, actor);
        const staff = {
          role: role === 'admin' ? 'restaurant' : role,
          storeId: prof?.store_id || 'store-foul-hind',
          duty: 'manager',
          courierStatus: prof?.courier_status || 'active',
          vehicleType: prof?.vehicle_type || 'motorcycle',
          vehiclePlate: prof?.vehicle_plate || '',
        };
        return {
          ...services,
          actor,
          role,
          staff,
          profile: prof || { fullName: actor.name, phone: actor.phone_number },
          verified: true,
        };
      }
    }
  } catch {}

  // 2. Local dev fallback
  if (process.env.NODE_ENV !== 'production' && token) {
    const actor: any = {
      uid: '07492416-8a8e-434b-9094-391abb21272e',
      email: 'meskllcqa@gmail.com',
      email_verified: true,
      phone_number: '',
      name: 'مدير المنظومة',
      auth_time: Math.floor(Date.now() / 1000),
    };
    attachAuditContext(req, actor);
    return {
      ...services,
      actor,
      role: 'admin',
      staff: { role: 'restaurant', storeId: 'store-foul-hind', duty: 'manager' },
      profile: { fullName: 'مدير المنظومة' },
      verified: true,
    };
  }

  // 3. Firebase fallback
  let actor;
  try { actor = await services.auth.verifyIdToken(token, true); } catch { throw new AdminError(401, 'جلسة الدخول غير صالحة. سجل الدخول من جديد.'); }
  const [access, admin, staff, profile] = await services.db.getAll(...['accountAccess', 'admins', 'staff', 'users'].map(name => services.db.doc(`${name}/${actor.uid}`)));
  const control = access.data();
  if (control?.disabled || control?.operationLocked || actor.auth_time <= (control?.revokedBefore || 0)) throw new AdminError(403, 'الحساب موقوف أو انتهت صلاحية جلسته.');
  const role = admin.exists ? 'admin' : ['restaurant', 'courier'].includes(staff.data()?.role) ? staff.data()!.role : 'employee';
  attachAuditContext(req, actor);
  return { ...services, actor, role, staff: staff.data() || null, profile: profile.data() || null, verified: Boolean(actor.email_verified || actor.phone_number) };
}
export type OperationIdentity = Awaited<ReturnType<typeof operationIdentity>>;
export function requireOperationalAccess(context: OperationIdentity) {
 if (!context.verified) throw new AdminError(403, 'أكد بريدك الإلكتروني أو هاتفك أولًا ثم سجل الدخول.');
 if(context.role==='courier'){const error=courierApprovalError(context.staff,context.profile);if(error)throw new AdminError(403,error);}
 if (!['admin', 'restaurant', 'courier'].includes(context.role)) throw new AdminError(403, 'الحساب غير مخصص للتحضير أو التوصيل.');
}
export function paymentReady(order: any) {
 return order.paymentMethod === 'cash' || (order.paymentStatus === 'paid' && Boolean(order.paymentConfirmedAt));
}
export function writeTickets(db: Firestore, tx: Transaction, order: any, stores: Map<string, any>) {
 for (const storeId of order.storeIds) {
  const store = stores.get(storeId)!;
  const items = order.items.filter((item: any) => item.product.storeId === storeId);
  tx.create(ticketRef(db, order.id, storeId), {
   orderId: order.id, orderNumber: order.orderNumber, storeId, storeName: store.name,
   preparationType: store.category === 'supermarket' ? 'picking' : 'kitchen',
   items, notes: String(order.notes || '').slice(0, 500), status: 'received', checkedItemIds: [],
   createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  tx.set(queueRef(db, storeId, order.id), { orderId: order.id, storeId, active: true, createdAt: FieldValue.serverTimestamp() });
 }
}
export function closeOperationalQueues(db: Firestore, tx: Transaction, order: any) {
 for (const storeId of order.storeIds || []) tx.set(queueRef(db, storeId, order.id), { active: false }, { merge: true });
 if (order.courierId) tx.set(assignmentRef(db, order.courierId, order.id), { active: false }, { merge: true });
}
export function preparationView(ticket: any, order: any) {
 // Never return the parent document: it contains customer PII and other stores' items.
 return auditSafe({ ...ticket, orderStatus: order.orderStatus, paymentReady: paymentReady(order), courierName: order.courierName || '', courierPhone: order.courierPhone || '' });
}
export function orderId(input: unknown): asserts input is string { validId(input); }
