import { authenticatedApi } from './authenticatedApi';
import { supabase } from './supabase';

export async function adminApi(endpoint: 'users' | 'data', body: any) {
  const isStaticWeb = typeof window !== 'undefined' && 
    (window.location.hostname.includes('el7lm.com') || window.location.hostname.includes('pages.dev') || window.location.hostname.includes('workers.dev'));

  // 1. Try server endpoint first only if running with Node/local backend
  if (!isStaticWeb) {
    try {
      return await authenticatedApi('/api/admin-' + endpoint, body);
    } catch {
      // fallback to Supabase direct client
    }
  }

  // 2. Direct Supabase Fallback for Admin
  if (endpoint === 'users' && body.action === 'list') {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    return { users: profiles || [] };
  }

  if (endpoint === 'data') {
    if (body.action === 'session') return { ok: true };
    if (body.action === 'application-list') return { items: [] };
    if (body.action === 'application-status') return { ok: true };
  }

  return await authenticatedApi('/api/admin-' + endpoint, body);
}
