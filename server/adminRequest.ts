import { attachAuditContext } from "./audit.ts";
import { supabaseIdentity, type SupabaseIdentity } from './supabaseIdentity.ts';

export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type AdminActor = SupabaseIdentity['actor'];
export async function requireAdmin(req: any): Promise<{ actor: AdminActor }> {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AdminError(401, 'يرجى تسجيل الدخول.');
  let identity;
  try {
    identity = await supabaseIdentity(token);
  } catch {
    throw new AdminError(503, 'تعذر التحقق من صلاحية الإدارة حاليًا.');
  }
  if (!identity) throw new AdminError(401, 'جلسة الدخول غير صالحة. سجل الدخول من جديد.');
  if (identity.actor.role !== 'admin') throw new AdminError(403, 'لا تملك صلاحية الإدارة.');
  attachAuditContext(req, identity.actor);
  return { actor: identity.actor };
}

export function adminError(res: any, error: any) {
  const code = String(error?.code || '');
  if (code === 'FIREBASE_ADMIN_NOT_CONFIGURED' || code.includes('invalid-credential')) {
    return res.status(503).json({ error: 'خدمة البيانات الإدارية غير متاحة حاليًا.' });
  }
  if (error instanceof AdminError) return res.status(error.status).json({ error: error.message, ...((error as any).fields ? { fields: (error as any).fields } : {}) });
  if (code.includes('email-already-exists')) return res.status(409).json({ error: 'البريد مستخدم في حساب آخر.' });
  if (code.includes('user-not-found')) return res.status(404).json({ error: 'الحساب غير موجود.' });
  if (code === '9' || code.includes('failed-precondition')) return res.status(503).json({ error: 'قاعدة البيانات غير جاهزة لهذه العملية.' });
  if (code.includes('invalid-')) return res.status(400).json({ error: 'راجع بيانات الحساب.' });
  return res.status(500).json({ error: 'تعذر تنفيذ العملية حاليًا.' });
}

export function validId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[\w-]{1,200}$/.test(value)) throw new AdminError(400, 'المعرّف غير صالح.');
}
