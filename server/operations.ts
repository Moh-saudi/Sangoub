import { courierApprovalError } from '../src/validation/accounts.ts';
import { AdminError, validId } from './adminRequest.ts';
import { attachAuditContext } from './audit.ts';
import { supabaseIdentity } from './supabaseIdentity.ts';
import type { SupabaseIdentity } from './supabaseIdentity.ts';

export const rolloutReady = () => process.env.OPERATIONS_V2_READY === 'true';
export const terminal = (status: string) => ['delivered', 'cancelled'].includes(status);

export type OperationBase = {
 actor: SupabaseIdentity['actor']; role: string; staff: Record<string, any> | null;
 profile: Record<string, any> | null; verified: boolean;
};
export async function operationIdentity(req: any): Promise<OperationBase> {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AdminError(401, 'يرجى تسجيل الدخول.');
  let identity;
  try {
    identity = await supabaseIdentity(token);
  } catch {
    throw new AdminError(503, 'تعذر التحقق من حساب Supabase حاليًا.');
  }
  if (!identity) throw new AdminError(401, 'جلسة الدخول غير صالحة. سجل الدخول من جديد.');
  const profile = identity.profile;
  const role = identity.actor.role;
  const assignment = identity.roleAssignments.find(item => item.role === role);
  const storeId = identity.actor.store_id || assignment?.storeId;
  if (role === 'restaurant' && !storeId) throw new AdminError(403, 'حساب المتجر غير مرتبط بفرع بعد.');
  attachAuditContext(req, identity.actor);
  const staff = profile ? {
    role,
    storeId,
    duty: assignment?.duty,
    courierStatus: profile.courier_status,
    vehicleType: profile.vehicle_type,
    vehiclePlate: profile.vehicle_plate,
  } : null;
  return {
    actor: identity.actor,
    role,
    staff,
    profile,
    verified: Boolean(identity.actor.email_verified || identity.actor.phone_number),
  };
}
export type OperationIdentity = OperationBase;
export function requireOperationalAccess(context: OperationIdentity) {
 if (!context.verified) throw new AdminError(403, 'أكد بريدك الإلكتروني أو هاتفك أولًا ثم سجل الدخول.');
 if(context.role==='courier'){const error=courierApprovalError(context.staff,context.profile);if(error)throw new AdminError(403,error);}
 if (!['admin', 'restaurant', 'courier'].includes(context.role)) throw new AdminError(403, 'الحساب غير مخصص للتحضير أو التوصيل.');
}
export function paymentReady(order: any) {
 return order.paymentMethod === 'cash' || (order.paymentStatus === 'paid' && Boolean(order.paymentConfirmedAt));
}
export function orderId(input: unknown): asserts input is string { validId(input); }
