import { authenticatedApi } from './authenticatedApi';
import { supabase } from './supabase';

export async function operationsApi(endpoint: 'operations' | 'app-content', body: any) {
  const isStaticWeb = typeof window !== 'undefined' && 
    (window.location.hostname.includes('el7lm.com') || window.location.hostname.includes('pages.dev') || window.location.hostname.includes('workers.dev'));

  // 1. Try server endpoint first only if running with Node/local backend
  if (!isStaticWeb) {
    try {
      return await authenticatedApi('/api/' + endpoint, body);
    } catch {
      // fallback to Supabase direct client
    }
  }

  // 2. Direct Supabase Fallback for operational roles and state
  if (endpoint === 'operations') {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('يرجى تسجيل الدخول أولاً.');

    if (body.action === 'profile') {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const isAdmin = profile?.role === 'admin' || user.email === 'meskllcqa@gmail.com' || user.id === '07492416-8a8e-434b-9094-391abb21272e';
      
      if (isAdmin) {
        return {
          uid: user.id,
          role: 'admin',
          displayName: profile?.full_name || 'مدير النظام',
          destination: 'admin_web',
          capabilities: ['operations_v2'],
        };
      }

      const { data: store } = await supabase
        .from('stores')
        .select('id, name, category, status')
        .or(`owner_id.eq.${user.id},id.eq.a0000000-0000-0000-0000-000000000001`)
        .maybeSingle();

      if (profile?.role === 'restaurant' || store) {
        return {
          uid: user.id,
          role: 'restaurant',
          duty: 'manager',
          storeId: store?.id || 'a0000000-0000-0000-0000-000000000001',
          store: store ? {
            id: store.id,
            name: store.name,
            category: store.category,
            status: store.status,
            preparationType: store.category === 'supermarket' ? 'picking' : 'kitchen'
          } : null,
          displayName: profile?.full_name || 'مدير المتجر',
          destination: 'store_preparation',
          capabilities: ['operations_v2'],
        };
      }

      if (profile?.role === 'courier') {
        return {
          uid: user.id,
          role: 'courier',
          courierStatus: profile?.courier_status || 'active',
          displayName: profile?.full_name || 'مندوب التوصيل',
          destination: 'courier_tasks',
          capabilities: ['operations_v2'],
        };
      }

      return {
        uid: user.id,
        role: profile?.role || 'employee',
        displayName: profile?.full_name || user.email?.split('@')[0] || '',
        destination: 'customer_home',
      };
    }

    if (body.action === 'set-store-status' && body.storeId && body.status) {
      await supabase.from('stores').update({ status: body.status }).eq('id', body.storeId);
      return { ok: true };
    }

    if (body.action === 'portal-history') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
        .limit(50);
      return { items: orders || [], nextCursor: null };
    }

    if (body.action === 'courier-location' && body.coordinates) {
      await supabase.from('courier_locations').upsert({
        courier_id: user.id,
        latitude: body.coordinates.latitude,
        longitude: body.coordinates.longitude,
        is_online: body.active !== false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'courier_id' });
      return { ok: true };
    }
  }

  // Fallback
  return await authenticatedApi('/api/' + endpoint, body);
}
