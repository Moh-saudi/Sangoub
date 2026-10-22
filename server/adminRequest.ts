import { attachAuditContext } from "./audit.ts";
import { adminServices } from './firebaseAdmin.ts';
export class AdminError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export async function requireAdmin(req: any) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AdminError(401, 'يرجى تسجيل الدخول.');
  const services = adminServices();
  let actor;
  try { actor = await services.auth.verifyIdToken(token, true); } catch { throw new AdminError(401, 'جلسة الدخول غير صالحة.'); }
  if ((!actor.email_verified && !actor.phone_number) || !(await services.db.doc('admins/' + actor.uid).get()).exists) throw new AdminError(403, 'هذه العملية للإدارة فقط.');
  const access=(await services.db.doc('accountAccess/'+actor.uid).get()).data();
  if(access&&actor.auth_time<=(access.revokedBefore||0))throw new AdminError(401,'أُلغيت هذه الجلسة. سجل الدخول من جديد.');
  if(access?.disabled||access?.operationLocked)throw new AdminError(403,'الحساب معطّل أو عليه عملية إدارة معلّقة.');
  attachAuditContext(req, actor);
  return { ...services, actor };
}
export function adminError(res: any, error: any) {
  const code = String(error?.code || '');
  if (code === 'FIREBASE_ADMIN_NOT_CONFIGURED') return res.status(503).json({error:'واجهة الإدارة تحتاج FIREBASE_CLIENT_EMAIL وFIREBASE_PRIVATE_KEY في إعدادات الخادم. مفاتيح R2 تخص الصور ولا تمنح صلاحية إدارة الحسابات.',code});
  if (code.includes('invalid-credential')) return res.status(503).json({error:'بيانات اعتماد Firebase Admin على الخادم غير صالحة. راجع إعدادها في منصة الاستضافة.',code:'FIREBASE_ADMIN_INVALID_CREDENTIALS'});
  if (error instanceof AdminError) return res.status(error.status).json({error:error.message});
  if (code.includes('email-already-exists')) return res.status(409).json({error:'البريد مستخدم في حساب آخر.'});
  if (code.includes('user-not-found')) return res.status(404).json({error:'الحساب غير موجود.'});
  if (code==='9'||code.includes('failed-precondition')) return res.status(503).json({error:'فهارس Firestore المطلوبة غير منشورة أو ما زالت قيد الإنشاء. انشر firestore.indexes.json وانتظر اكتمالها.'});
  if (code.includes('invalid-')) return res.status(400).json({error:'راجع بيانات الحساب.'});
  return res.status(503).json({error:'تعذر تنفيذ العملية. راجع إعدادات Firebase Admin بالخادم وسجل التدقيق.'});
}
export function validId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.@+-]{1,128}$/.test(value)) throw new AdminError(400,'معرّف غير صالح.');
}
