import { authenticatedApi } from './authenticatedApi';
import { supabase, resolveSupabaseStoreUuid } from './supabase';
import systemAccounts from '../data/systemAccounts.json';
import { defaultCustomerHome } from '../types/appContent';

function mapOrderRow(row: any) {
  const appStatus = row.status === 'assigned' || row.status === 'picked_up' ? 'with_courier' : (row.status || 'received');
  const isCash = (row.payment_method || 'cash') === 'cash';
  const totalAmount = Number(row.total_amount) || Number(row.total) || 0;
  return {
    id: row.id,
    profileId: row.customer_id,
    profileName: row.customer_name || '',
    phone: row.customer_phone || '',
    courierId: row.courier_id || '',
    courierName: row.courier_name || '',
    courierPhone: row.courier_phone || '',
    storeId: row.store_id,
    storeIds: row.store_ids || (row.store_id ? [row.store_id] : []),
    storeName: row.stores?.name || row.restaurant_name || 'متجر سنجوب',
    orderNumber: row.order_number || row.id,
    orderStatus: appStatus,
    status: appStatus,
    estimatedDelivery: row.estimated_delivery || '',
    subtotal: Number(row.subtotal) || 0,
    deliveryFee: Number(row.delivery_fee) || 0,
    discount: Number(row.discount) || 0,
    tip: Number(row.tip) || 0,
    taxTotal: Number(row.tax_total) || 0,
    total: totalAmount,
    amountToCollect: isCash ? totalAmount : 0,
    receiptUrl: row.receipt_url || '',
    storeCoordinates: (Number.isFinite(row.stores?.latitude) && Number.isFinite(row.stores?.longitude))
      ? { latitude: row.stores.latitude, longitude: row.stores.longitude } : undefined,
    ministry: row.delivery_ministry || '',
    floorNumber: row.delivery_floor || '',
    roomNumber: row.delivery_room || '',
    deliveryAddress: row.delivery_address || row.delivery_ministry || '',
    coordinates: row.coordinates || (Number.isFinite(row.delivery_lat) && Number.isFinite(row.delivery_lng)
      ? { latitude: row.delivery_lat, longitude: row.delivery_lng } : undefined),
    paymentMethod: row.payment_method || 'cash',
    paymentStatus: row.payment_status || 'pending',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at,
    items: (row.order_items || []).map((item: any) => ({
      id: item.id,
      product: {
        id: item.product_id,
        storeId: item.store_id || row.store_id,
        name: item.product_name,
        price: Number(item.price) || 0
      },
      quantity: Number(item.quantity) || 1,
      selectedOptions: item.selected_options || {},
      extraPrice: Number(item.extra_price) || 0,
      notes: item.notes || '',
    })),
  };
}

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
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();
        profile = p;
      } catch (err) {
        console.warn('[operationsApi] profiles fetch warning:', err);
      }

      // 0. System accounts lookup fallback (e.g. tarek@san.com, central@sangoub.com)
      const systemAccount = (systemAccounts as any[]).find(
        (acc: any) => acc.email?.toLowerCase() === user.email?.toLowerCase()
      );

      const effectiveRole = profile?.role || systemAccount?.role || 'employee';
      const effectiveStoreId = profile?.store_id || systemAccount?.storeId || null;

      const isAdmin = effectiveRole === 'admin' || 
        user.email === 'meskllcqa@gmail.com' || 
        user.email === 'el7lm25@gmail.com' || 
        user.email?.toLowerCase().includes('el7lm') || 
        user.email?.toLowerCase().includes('mesk') || 
        user.id === '07492416-8a8e-434b-9094-391abb21272e';
      
      if (isAdmin) {
        let adminStore: any = null;
        try {
          if (effectiveStoreId) {
            const { data: s } = await supabase.from('stores').select('id, name, category, status').eq('id', effectiveStoreId).maybeSingle();
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
          displayName: profile?.full_name || systemAccount?.fullName || 'مدير النظام',
          destination: 'admin_web',
          capabilities: ['operations_v2'],
        };
      }

      const isCentralStoreAccount = 
        user.email === 'central@sangoub.com' || 
        user.email === 'market@sangoub.com' ||
        user.email === 'hq@sangoub.com';

      if (isCentralStoreAccount) {
        return {
          uid: user.id,
          role: 'restaurant',
          duty: 'manager',
          storeId: 'a0000000-0000-0000-0000-000000000001',
          store: {
            id: 'a0000000-0000-0000-0000-000000000001',
            name: 'متجر سنجوب إكسبريس المركزي',
            category: 'supermarket',
            status: 'open',
            preparationType: 'picking'
          },
          displayName: profile?.full_name || 'مدير متجر سنجوب المركزي',
          destination: 'store_preparation',
          capabilities: ['operations_v2'],
        };
      }

      // Check merchant store strictly without blindly fallback to central supermarket!
      if (effectiveRole === 'restaurant') {
        let store: any = null;

        // 1. Check assigned store by ID
        if (effectiveStoreId) {
          const { data: assignedStore } = await supabase
            .from('stores')
            .select('id, name, category, status')
            .eq('id', resolveSupabaseStoreUuid(effectiveStoreId))
            .maybeSingle();
          if (assignedStore) store = assignedStore;
        }

        // 2. Direct owner check in database
        if (!store) {
          const { data: ownedStore } = await supabase
            .from('stores')
            .select('id, name, category, status')
            .or(`owner_id.eq.${user.id}${profile?.id ? `,owner_id.eq.${profile.id}` : ''}`)
            .maybeSingle();
          if (ownedStore) store = ownedStore;
        }

        const finalStoreId = store?.id || effectiveStoreId || null;

        return {
          uid: user.id,
          role: 'restaurant',
          duty: profile?.duty || systemAccount?.duty || 'manager',
          storeId: finalStoreId,
          store: store ? {
            id: store.id,
            name: store.name,
            category: store.category,
            status: store.status,
            preparationType: store.category === 'supermarket' ? 'picking' : 'kitchen'
          } : null,
          displayName: profile?.full_name || systemAccount?.fullName || 'مدير المتجر',
          destination: 'store_preparation',
          capabilities: ['operations_v2'],
        };
      }

      if (profile?.role === 'courier') {
        return {
          uid: user.id,
          role: 'courier',
          courierStatus: profile?.courier_status || 'active',
          displayName: profile?.full_name || 'كابتن التوصيل',
          fullName: profile?.full_name || '',
          email: profile?.email || user.email || '',
          phone: profile?.phone || '',
          emergencyPhone: profile?.emergency_phone || '',
          nationalId: profile?.national_id || '',
          avatarUrl: profile?.avatar_url || '',
          vehicleType: profile?.vehicle_type || 'motorcycle',
          vehiclePlate: profile?.vehicle_plate || '',
          vehicleMake: profile?.vehicle_make || '',
          vehicleModel: profile?.vehicle_model || '',
          vehicleYear: profile?.vehicle_year || '',
          hasThermalBox: profile?.has_thermal_box || false,
          hasThermalBackpack: profile?.has_thermal_backpack || false,
          medicalCheck: profile?.medical_check || 'pending',
          criminalRecord: profile?.criminal_record || 'pending',
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
      try {
        let isCourier = Boolean(body.courierId);
        if (!isCourier) {
          const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          if (p?.role === 'courier') isCourier = true;
        }

        let query = supabase
          .from('orders')
          .select('*, order_items(*)')
          .not('status', 'in', '("delivered","cancelled")')
          .order('created_at', { ascending: false })
          .limit(100);

        if (isCourier) {
          query = query.eq('courier_id', user.id);
        } else if (body.storeId) {
          query = query.eq('store_id', body.storeId);
        }

        const { data: orders, error } = await query;
        if (error) console.warn('[operationsApi] portal-active query warning:', error);
        return { items: (orders || []).map(mapOrderRow), truncated: false };
      } catch (err) {
        console.warn('[operationsApi] portal-active fetch error:', err);
        return { items: [], truncated: false };
      }
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
      const nextStatus = stage === 'ready' ? 'ready' : 'preparing';
      await supabase.from('orders').update({
        status: nextStatus
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

    if (body.action === 'store-customers') {
      try {
        const storeId = body.storeId || '';
        let targetStoreUuid = '';
        if (storeId) {
          try {
            targetStoreUuid = resolveSupabaseStoreUuid(storeId);
          } catch {
            targetStoreUuid = storeId;
          }
        }
        
        let query = supabase
          .from('orders')
          .select('id, order_number, customer_id, customer_name, total_amount, created_at, status, courier_name, address')
          .order('created_at', { ascending: false })
          .limit(200);

        if (targetStoreUuid) {
          query = query.eq('store_id', targetStoreUuid);
        }

        const { data: rows, error } = await query;
        if (error) {
          console.warn('[operationsApi] store-customers error:', error);
          return { items: [], nextCursor: null, truncated: false };
        }

        const customerMap = new Map<string, {
          id: string;
          name: string;
          orderIds: string[];
          orderCount: number;
          totalSpent: number;
          lastOrderAt: string;
          orders: Array<{
            id: string;
            orderNumber: string;
            amount: number;
            createdAt: string;
            status: string;
            courierName?: string;
          }>;
        }>();

        for (const row of (rows || [])) {
          const key = row.customer_id || row.customer_name || 'عميل مجهول';
          const name = row.customer_name || 'عميل سنجوب';
          const orderNum = row.order_number || String(row.id).slice(0, 8);
          const amount = Number(row.total_amount) || 0;
          const createdAt = row.created_at || '';
          const courierName = row.courier_name || '';

          const orderItem = {
            id: row.id,
            orderNumber: orderNum,
            amount,
            createdAt,
            status: row.status || 'received',
            courierName,
          };

          if (!customerMap.has(key)) {
            customerMap.set(key, {
              id: key,
              name,
              orderIds: [orderNum],
              orderCount: 1,
              totalSpent: amount,
              lastOrderAt: createdAt,
              orders: [orderItem],
            });
          } else {
            const existing = customerMap.get(key)!;
            existing.orderIds.push(orderNum);
            existing.orderCount += 1;
            existing.totalSpent += amount;
            existing.orders.push(orderItem);
            if (createdAt && (!existing.lastOrderAt || new Date(createdAt) > new Date(existing.lastOrderAt))) {
              existing.lastOrderAt = createdAt;
            }
          }
        }

        return {
          items: Array.from(customerMap.values()),
          nextCursor: null,
          truncated: (rows || []).length >= 200,
        };
      } catch (err) {
        console.warn('[operationsApi] store-customers caught:', err);
        return { items: [], nextCursor: null, truncated: false };
      }
    }

    if (body.action === 'store-payments') {
      try {
        const storeId = body.storeId || '';
        let targetStoreUuid = '';
        if (storeId) {
          try {
            targetStoreUuid = resolveSupabaseStoreUuid(storeId);
          } catch {
            targetStoreUuid = storeId;
          }
        }

        let query = supabase
          .from('orders')
          .select('id, order_number, total_amount, created_at, status')
          .eq('status', 'delivered')
          .order('created_at', { ascending: false })
          .limit(200);

        if (targetStoreUuid) {
          query = query.eq('store_id', targetStoreUuid);
        }

        const { data: rows, error } = await query;
        if (error) {
          console.warn('[operationsApi] store-payments error:', error);
          return { items: [], nextCursor: null, truncated: false };
        }

        const totalGross = (rows || []).reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
        const commissionRate = 0.10;
        const totalCommission = Math.round(totalGross * commissionRate);
        const totalNet = totalGross - totalCommission;

        const payments = (rows && rows.length > 0) ? [{
          id: 'SETTLE-' + (storeId ? storeId.slice(0, 8) : 'ALL'),
          gross: totalGross,
          commission: totalCommission,
          net: totalNet,
          reference: 'تسوية مبيعات الطلبات المسلمة',
          orderCount: rows.length,
          createdAt: new Date().toISOString(),
        }] : [];

        return { items: payments, nextCursor: null, truncated: false };
      } catch (err) {
        console.warn('[operationsApi] store-payments caught:', err);
        return { items: [], nextCursor: null, truncated: false };
      }
    }

    if (typeof body.action === 'string' && body.action.startsWith('store-')) {
      return { items: [], nextCursor: null, truncated: false };
    }

    if (body.action === 'courier-tasks') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['ready', 'assigned', 'picked_up'])
        .order('created_at', { ascending: false });
      return { tasks: (orders || []).map(mapOrderRow), items: (orders || []).map(mapOrderRow) };
    }

    if (body.action === 'set-store-status' && body.storeId && body.status) {
      await supabase.from('stores').update({ status: body.status }).eq('id', body.storeId);
      return { ok: true };
    }

    if (body.action === 'portal-history') {
      try {
        let isCourier = Boolean(body.courierId);
        if (!isCourier) {
          const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          if (p?.role === 'courier') isCourier = true;
        }

        let query = supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('status', ['delivered', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (isCourier) {
          query = query.eq('courier_id', user.id);
        } else if (body.storeId) {
          query = query.eq('store_id', body.storeId);
        }

        const { data: orders } = await query;
        return { items: (orders || []).map(mapOrderRow), nextCursor: null };
      } catch {
        return { items: [], nextCursor: null };
      }
    }

    if (body.action === 'update-profile') {
      // 1. Base updates guaranteed by schema
      const baseUpdates: any = {
        updated_at: new Date().toISOString()
      };
      if (body.fullName !== undefined) baseUpdates.full_name = body.fullName;
      if (body.phone !== undefined) baseUpdates.phone = body.phone;
      if (body.avatarUrl !== undefined) baseUpdates.avatar_url = body.avatarUrl;
      if (body.courierStatus !== undefined) baseUpdates.courier_status = body.courierStatus;

      // vehicle_type check constraint: ('motorcycle', 'bicycle', 'car', 'auto')
      if (body.vehicleType !== undefined) {
        const v = String(body.vehicleType).toLowerCase();
        baseUpdates.vehicle_type = ['motorcycle', 'bicycle', 'car', 'auto'].includes(v)
          ? v
          : (v === 'scooter' ? 'auto' : 'motorcycle');
      }
      if (body.vehiclePlate !== undefined) baseUpdates.vehicle_plate = body.vehiclePlate;
      if (body.vehicleMake !== undefined) baseUpdates.vehicle_make = body.vehicleMake;
      if (body.vehicleModel !== undefined) baseUpdates.vehicle_model = body.vehicleModel;
      if (body.hasThermalBox !== undefined) baseUpdates.has_thermal_box = Boolean(body.hasThermalBox);
      if (body.hasThermalBackpack !== undefined) baseUpdates.has_thermal_backpack = Boolean(body.hasThermalBackpack);

      // 2. Try full update with extended columns first
      const fullUpdates: any = { ...baseUpdates };
      if (body.emergencyPhone !== undefined) fullUpdates.emergency_phone = body.emergencyPhone;
      if (body.nationalId !== undefined) fullUpdates.national_id = body.nationalId;
      if (body.vehicleYear !== undefined) fullUpdates.vehicle_year = body.vehicleYear;

      try {
        const { error: fullErr } = await supabase
          .from('profiles')
          .update(fullUpdates)
          .eq('id', user.id);
        if (!fullErr) return { ok: true };
        console.warn('[update-profile] Extended update error, falling back to base columns:', fullErr.message);
      } catch (err) {
        console.warn('[update-profile] Full update exception, attempting base columns:', err);
      }

      // 3. Fallback: update only base columns (never fails on missing optional columns)
      try {
        const { error: baseErr } = await supabase
          .from('profiles')
          .update(baseUpdates)
          .eq('id', user.id);
        if (!baseErr) return { ok: true };
        console.warn('[update-profile] Base update error, attempting minimal profile save:', baseErr.message);
      } catch (err) {
        console.warn('[update-profile] Base update exception:', err);
      }

      // 4. Ultra safe minimal update (full_name and avatar only)
      await supabase
        .from('profiles')
        .update({
          full_name: baseUpdates.full_name || 'كابتن التوصيل',
          avatar_url: baseUpdates.avatar_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      return { ok: true };
    }

    if (body.action === 'upload-receipt' && body.orderId && body.receiptUrl) {
      try {
        await supabase
          .from('orders')
          .update({
            receipt_url: body.receiptUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', body.orderId);
      } catch (e) {
        console.warn('Failed to save receipt_url directly in orders:', e);
      }
      return { ok: true };
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
      const content = (row?.content && typeof row.content === 'object') ? row.content : {};
      if (!content.config || !Array.isArray(content.config.sections)) {
        content.config = {
          ...defaultCustomerHome,
          ...(content.config || {}),
          sections: Array.isArray(content.config?.sections) && content.config.sections.length > 0
            ? content.config.sections
            : defaultCustomerHome.sections
        };
      }
      return content;
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
