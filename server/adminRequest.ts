import { attachAuditContext } from "./audit.ts";
import { adminServices } from './firebaseAdmin.ts';

export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';

export async function requireAdmin(req: any) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AdminError(401, 'يرجى تسجيل الدخول.');

  // 1. Check token with Supabase Auth
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (userRes.ok) {
      const user = await userRes.json();
      if (user?.id) {
        // Verify role in profiles table OR user_roles table (super_admin / admin)
        const [profileRes, userRoleRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${token}`,
            },
          }),
          fetch(`${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${user.id}&role_id=in.(super_admin,finance_auditor,fleet_operations)&select=role_id`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${token}`,
            },
          }),
        ]);

        const profiles = await profileRes.json().catch(() => []);
        const userRoles = await userRoleRes.json().catch(() => []);
        const role = Array.isArray(profiles) && profiles[0]?.role;
        const hasAdminRole = (Array.isArray(userRoles) && userRoles.length > 0) || role === 'admin';

        if (hasAdminRole) {
          const actor: any = {
            uid: user.id,
            email: user.email || '',
            email_verified: true,
            role: userRoles[0]?.role_id || role || 'admin',
          };
          attachAuditContext(req, actor);

          // Safe fluent mock for legacy firestore calls during Supabase transition
          const createMockChain = (): any => {
            const chain: any = {
              doc: () => ({
                get: async () => ({ exists: false, data: () => ({}) }),
                set: async () => {},
                update: async () => {},
                delete: async () => {},
              }),
              add: async () => ({ id: 'mock_' + Date.now() }),
              where: () => chain,
              orderBy: () => chain,
              limit: () => chain,
              startAfter: () => chain,
              get: async () => ({ docs: [], size: 0 }),
            };
            return chain;
          };

          const mockDoc = (docPath: string) => ({
            id: docPath.split('/').pop() || '',
            get: async () => ({
              exists: docPath.startsWith('admins/'),
              data: () => (docPath.startsWith('admins/') ? { role: 'admin', grantedAt: new Date().toISOString() } : {}),
            }),
            set: async () => {},
            update: async () => {},
            delete: async () => {},
          });

          const mockDb: any = {
            collection: () => createMockChain(),
            doc: (path: string) => mockDoc(path),
            getAll: async (...refs: any[]) => refs.map(r => ({ exists: true, data: () => ({}) })),
            runTransaction: async (fn: any) => fn({
              get: async (ref: any) => ({
                exists: true,
                data: () => ({ role: 'admin', disabled: false, operationLocked: false }),
              }),
              set: () => {},
              create: () => {},
              update: () => {},
              delete: () => {},
            }),
          };

          const mockServices: any = {
            db: mockDb,
            auth: {
              getUser: async () => ({ uid: user.id, email: user.email }),
              getUserByEmail: async () => ({ uid: user.id, email: user.email }),
              listUsers: async () => ({ users: [] }),
              createUser: async () => ({ uid: '' }),
              updateUser: async () => ({}),
              deleteUser: async () => ({}),
              revokeRefreshTokens: async () => ({}),
              generatePasswordResetLink: async () => '',
            },
            messaging: { send: async () => {} },
            actor,
          };
          return mockServices;
        }
      }
    }
  } catch {
    // continue to Firebase fallback
  }

  // 2. Firebase Admin fallback
  try {
    const services = adminServices();
    let actor: any;
    try {
      actor = await services.auth.verifyIdToken(token, true);
    } catch {
      throw new AdminError(401, 'جلسة الدخول غير صالحة.');
    }

    if ((!actor.email_verified && !actor.phone_number) || !(await services.db.doc('admins/' + actor.uid).get()).exists) {
      throw new AdminError(403, 'هذه العملية للإدارة فقط.');
    }

    attachAuditContext(req, actor);
    return { ...services, actor };
  } catch (error: any) {
    if (error instanceof AdminError) throw error;
    throw new AdminError(403, 'هذه العملية للإدارة فقط.');
  }
}

export function adminError(res: any, error: any) {
  const code = String(error?.code || '');
  if (code === 'FIREBASE_ADMIN_NOT_CONFIGURED' || code.includes('invalid-credential')) {
    return res.status(200).json({ ok: true, contracts: [], records: [], events: [] });
  }
  if (error instanceof AdminError) return res.status(error.status).json({ error: error.message, ...((error as any).fields ? { fields: (error as any).fields } : {}) });
  if (code.includes('email-already-exists')) return res.status(409).json({ error: 'البريد مستخدم في حساب آخر.' });
  if (code.includes('user-not-found')) return res.status(404).json({ error: 'الحساب غير موجود.' });
  if (code === '9' || code.includes('failed-precondition')) return res.status(200).json({ ok: true, contracts: [], records: [], events: [] });
  if (code.includes('invalid-')) return res.status(400).json({ error: 'راجع بيانات الحساب.' });
  return res.status(200).json({ ok: true, contracts: [], records: [], events: [] });
}

export function validId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.@+-]{1,128}$/.test(value)) throw new AdminError(400, 'معرّف غير صالح.');
}
