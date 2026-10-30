import { supabase } from './supabase';
import { auth } from './firebase';
import { apiUrl } from './apiUrl';

/** One authenticated JSON transport for admin and operations actions; mutations are never retried automatically. */
export async function authenticatedApi(path: string, body: object) {
  let token: string | undefined;

  // 1. Try Supabase session token first (with auto-refresh)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      // If token expires in less than 60 seconds, refresh it automatically
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      if (expiresAt > 0 && expiresAt - Date.now() < 60000) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token || session.access_token;
      } else {
        token = session.access_token;
      }
    }
  } catch {
    // ignore
  }

  // 2. Fallback to Firebase user token if present (force refresh if needed)
  if (!token) {
    const user = auth?.currentUser;
    if (user) {
      token = await user.getIdToken(/* forceRefresh */ false).catch(() => user.getIdToken(true));
    }
  }

  if (!token) throw new Error('يرجى تسجيل الدخول.');

  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  const result = await response.json().catch(() => ({ error: 'الخدمة غير متاحة حاليًا. يرجى المحاولة لاحقًا.' }));
  if (!response.ok) {
    throw Object.assign(
      new Error(
        (result.error || 'تعذر تنفيذ العملية.') +
          (typeof result.incidentId === 'string' ? ' · معرّف الخطأ: ' + result.incidentId.slice(0, 80) : '')
      ),
      { status: response.status, fields: result.fields }
    );
  }
  return result;
}
