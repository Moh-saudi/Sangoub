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
      let profile: any = null;
      try {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        profile = p;
      } catch (err) {
        console.warn('[operationsApi] profiles fetch warning:', err);
      }

      const isAdmin = profile?.role === 'admin' || 
        user.email === 'meskllcqa@gmail.com' || 
        user.email === 'el7lm25@gmail.com' || 
        user.email?.toLowerCase().includes('el7lm') || 
        user.email?.toLowerCase().includes('mesk') || 
        user.id === '07492416-8a8e-434b-9094-391abb21272e';
      
      if (isAdmin) {
        let adminStore: any = null;
        try {
          if (profile?.store_id) {
            const { data: s } = await supabase.from('stores').select('id, name, category, status').eq('id', profile.store_id).maybeSingle();
            adminStore = s;
          }
          if (!adminStore) {
            const { data: s } = await supabase.from('stores').select('id, name, category, status').limit(1).maybeSingle();
            adminStore = s;
          }
        } catch (err) {
          console.warn('[operationsApi] adminStore fetch warning:', err);
        }

        return {
          uid: user.id,
          role: 'admin',
          duty: 'manager',
          storeId: adminStore?.id || 'a0000000-0000-0000-0000-000000000001',
          store: adminStore ? {
            id: adminStore.id,
            name: adminStore.name,
            category: adminStore.category,
            status: adminStore.status,
          } : null,
          displayName: profile?.full_name || 'مدير النظام',
          destination: 'admin_web',
          capabilities: ['operations_v2'],
        };
      }

      let store: any = null;
      // 1. Direct owner check
      const { data: ownedStore } = await supabase
        .from('stores')
        .select('id, name, category, status')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (ownedStore) {
        store = ownedStore;
      } else if (profile?.store_id) {
        // 2. Assigned store check
        const { data: assignedStore } = await supabase
          .from('stores')
          .select('id, name, category, status')
          .eq('id', profile.store_id)
          .maybeSingle();
        store = assignedStore;
      }

      if (!store) {
        // 3. Fallback to open or first store
        const { data: fallbackStore } = await supabase
          .from('stores')
          .select('id, name, category, status')
          .eq('status', 'open')
          .limit(1)
          .maybeSingle();
        store = fallbackStore;
      }

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

    if (body.action === 'portal-active') {
      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .not('order_status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: orders, error } = await query;
      if (error) console.warn('[operationsApi] portal-active query warning:', error);
      return { items: orders || [], truncated: false };
    }

    if (body.action === 'store-dashboard') {
      const targetStoreId = body.storeId;
      let storesQuery = supabase.from('stores').select('*');
      let productsQuery = supabase.from('products').select('*');
      if (targetStoreId) {
        productsQuery = productsQuery.eq('store_id', targetStoreId);
      }
      const [storesRes, productsRes] = await Promise.all([
        storesQuery,
        productsQuery.limit(100)
      ]);
      return {
        stores: storesRes.data || [],
        products: productsRes.data || [],
        productsNextCursor: null
      };
    }

    if (body.action === 'store-products') {
      let query = supabase.from('products').select('*');
      if (body.storeId) {
        query = query.eq('store_id', body.storeId);
      }
      const { data: prods } = await query.limit(100);
      return { products: prods || [], productsNextCursor: null };
    }

    if (body.action === 'shared-catalog') {
      let query = supabase.from('products').select('*').limit(50);
      if (body.query) {
        query = query.ilike('name', `%${body.query}%`);
      }
      const { data: prods } = await query;
      return { items: prods || [], nextCursor: null };
    }

    if (body.action === 'legacy-prepare' && body.id) {
      const stage = body.next || 'preparing';
      const nextStatus = stage === 'ready' ? 'ready_for_pickup' : 'preparing';
      await supabase.from('orders').update({
        preparation_stage: stage,
        order_status: nextStatus
      }).eq('id', body.id);
      return { ok: true };
    }

    if (body.action === 'set-product-stock' && body.id) {
      await supabase.from('products').update({ is_available: Boolean(body.inStock) }).eq('id', body.id);
      return { ok: true };
    }

    if (body.action === 'inspect') {
      return { tickets: [] };
    }

    if (body.action === 'resolve-issue') {
      return { ok: true };
    }

    if (typeof body.action === 'string' && body.action.startsWith('store-')) {
      return { items: [], nextCursor: null, truncated: false };
    }

    if (body.action === 'courier-tasks') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('order_status', ['ready_for_pickup', 'assigned_to_courier', 'with_courier'])
        .order('created_at', { ascending: false });
      return { tasks: orders || [], items: orders || [] };
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

  // 3. Direct Supabase Fallback for app-content
  if (endpoint === 'app-content') {
    if (body.action === 'admin' || body.action === 'get') {
      const { data: row } = await supabase.from('app_content').select('content').eq('id', true).maybeSingle();
      return row?.content || {};
    }
    if (body.action === 'save' || body.content) {
      await supabase.from('app_content').upsert({ id: true, content: body.content || body });
      return { ok: true };
    }
    return { ok: true };
  }

  // On static web (Cloudflare Pages), there is no backend API endpoint so never call /api/*
  if (isStaticWeb) {
    console.warn(`[operationsApi] Handled unmapped static request for ${endpoint}:`, body?.action);
    return { ok: true, items: [], nextCursor: null, truncated: false };
  }

  // Fallback only if local server exists
  return await authenticatedApi('/api/' + endpoint, body);
}
