import { authenticatedApi } from './authenticatedApi';
import { supabase, resolveSupabaseStoreUuid } from './supabase';
import systemAccounts from '../data/systemAccounts.json';
import { defaultCustomerHome } from '../types/appContent';
import { DEFAULT_SANGOUB_BANNERS } from '../storefront/types/banner';
import { cleanCourierName, cleanCustomerName } from '../utils/sanitizeName';
import { getCuratedProductImageSync } from '../utils/productImageFinder';

function mapOrderRow(row: any, productImgMap?: Map<string, string>) {
  const appStatus = row.status === 'assigned' || row.status === 'picked_up' || row.status === 'with_courier' ? 'with_courier' : (row.status || 'received');
  const isCash = (row.payment_method || 'cash') === 'cash';
  const totalAmount = Number(row.total_amount) || Number(row.total) || 0;
  return {
    id: row.id,
    profileId: row.customer_id,
    profileName: cleanCustomerName(row.customer_name, row.customer_phone, row.customer_email),
    phone: row.customer_phone || '',
    courierId: row.courier_id || '',
    courierName: cleanCourierName(row.courier_name, row.courier_phone),
    courierPhone: row.courier_phone || '',
    storeId: row.store_id,
    storeIds: row.store_ids || (row.store_id ? [row.store_id] : []),
    storeName: row.stores?.name || row.restaurant_name || 'متجر سنجوب',
    orderNumber: row.order_number || row.id,
    orderStatus: appStatus,
    status: appStatus,
    received: Boolean(row.received || row.picked_up_at || row.status === 'picked_up' || row.status === 'with_courier' || row.status === 'delivered'),
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
    items: (row.order_items || []).map((item: any) => {
      const pId = item.product_id || item.product?.id;
      const dbImg = pId && productImgMap?.get(pId);
      const img = dbImg || item.image_url || item.image || item.product_image || item.imageUrl || item.products?.image_url || item.product?.imageUrl || getCuratedProductImageSync(item.product_name || item.name || item.product?.name);
      return {
        id: item.id,
        product: {
          id: pId,
          storeId: item.store_id || row.store_id,
          name: item.product_name || item.name || item.product?.name,
          price: Number(item.price) || Number(item.product?.price) || 0,
          imageUrl: img,
        },
        quantity: Number(item.quantity) || 1,
        selectedOptions: item.selected_options || item.selectedOptions || {},
        extraPrice: Number(item.extra_price) || Number(item.extraPrice) || 0,
        notes: item.notes || '',
      };
    }),
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
          .not('status', 'in', '(delivered,cancelled)')
          .order('created_at', { ascending: false })
          .limit(100);

        if (isCourier) {
          query = query.eq('courier_id', user.id);
        } else if (body.storeId) {
          query = query.eq('store_id', body.storeId);
        }

        let { data: orders, error } = await query;
        if (error) {
          console.warn('[operationsApi] portal-active query warning, retrying with simple select:', error);
          let simpleQuery = supabase
            .from('orders')
            .select('*')
            .not('status', 'in', '(delivered,cancelled)')
            .order('created_at', { ascending: false })
            .limit(50);
          if (isCourier) simpleQuery = simpleQuery.eq('courier_id', user.id);
          else if (body.storeId) simpleQuery = simpleQuery.eq('store_id', body.storeId);
          const simpleRes = await simpleQuery;
          orders = simpleRes.data;
        }
        if (error) console.warn('[operationsApi] portal-active query warning:', error);

        // Fetch real product images from products table for all items
        const productIds = Array.from(new Set(
          (orders || []).flatMap((o: any) => o.order_items || []).map((i: any) => i.product_id).filter(Boolean)
        ));
        const productImgMap = new Map<string, string>();
        if (productIds.length > 0) {
          try {
            const { data: prods } = await supabase
              .from('products')
              .select('id, image_url')
              .in('id', productIds);
            if (prods) {
              for (const p of prods) {
                if (p.id && p.image_url) {
                  productImgMap.set(p.id, p.image_url);
                }
              }
            }
          } catch {}
        }

        return { items: (orders || []).map((row: any) => mapOrderRow(row, productImgMap)), truncated: false };
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

    if (body.action === 'assign-courier' && body.orderId && body.courierId) {
      let courierName = cleanCourierName(body.courierName, body.courierPhone);
      let courierPhone = body.courierPhone;
      if (!courierName || courierName === 'كابتن توصيل' || !courierPhone) {
        try {
          const { data: prof } = await supabase.from('profiles').select('full_name, phone').eq('id', body.courierId).maybeSingle();
          if (prof) {
            courierName = cleanCourierName(body.courierName || prof.full_name, prof.phone);
            courierPhone = courierPhone || prof.phone || '';
          }
        } catch {}
      }

      const { error: updateErr } = await supabase.from('orders').update({
        courier_id: body.courierId,
        courier_name: courierName,
        courier_phone: courierPhone || null,
        status: body.nextStatus || 'ready',
        updated_at: new Date().toISOString()
      }).eq('id', body.orderId);

      if (updateErr) {
        console.warn('[operationsApi] assign-courier update fallback:', updateErr);
        const { error: fallbackErr } = await supabase.from('orders').update({
          courier_id: body.courierId,
          status: body.nextStatus || 'ready'
        }).eq('id', body.orderId);
        if (fallbackErr) throw fallbackErr;
      }

      // Create notification for courier
      try {
        await supabase.from('notifications').insert({
          user_id: body.courierId,
          title: `مهمة توصيل مسندة إليك #${body.orderNumber || ''}`,
          body: `تم تكليفك بالطلب #${body.orderNumber || ''}، يرجى الاستلام والبدء في التوصيل.`,
          type: 'order',
          data: { orderId: body.orderId }
        });
      } catch {}

      return { ok: true };
    }

    // -------------------------------------------------------------
    // Courier Pickup from Store
    // -------------------------------------------------------------
    if (body.action === 'courier-pickup' || body.action === 'pickup') {
      const orderId = body.orderId || body.id;
      if (orderId) {
        const { data: ord } = await supabase
          .from('orders')
          .select('id, customer_id, store_id, order_number, courier_name')
          .eq('id', orderId)
          .maybeSingle();

        const pickedUpAt = new Date().toISOString();

        // Update orders table (Try with_courier first, fallback to picked_up if constraint limits)
        let { error: updErr } = await supabase.from('orders').update({
          status: 'with_courier',
          updated_at: pickedUpAt
        }).eq('id', orderId);

        if (updErr) {
          console.warn('[operationsApi] with_courier status constraint fallback to picked_up:', updErr);
          const { error: fbErr } = await supabase.from('orders').update({
            status: 'picked_up',
            updated_at: pickedUpAt
          }).eq('id', orderId);
          if (fbErr) {
            console.error('[operationsApi] courier pickup update error:', fbErr);
          }
        }

        // Try non-blocking metadata update if table supports picked_up_at
        try {
          await supabase.from('orders').update({
            picked_up_at: pickedUpAt
          }).eq('id', orderId);
        } catch {}

        const orderNum = ord?.order_number || String(orderId).slice(0, 8);
        const courierName = ord?.courier_name || user.displayName || 'الكابتن';

        // 1. Notify Customer in Supabase
        if (ord?.customer_id) {
          try {
            await supabase.from('notifications').insert({
              user_id: ord.customer_id,
              title: 'المندوب استلم طلبك وهو في الطريق إليك 🛵',
              body: `تم استلام طلبك رقم #${orderNum} من المتجر بواسطة ${courierName}، وهو في طريقه إليك الآن.`,
              type: 'order',
              data: { orderId, status: 'with_courier' }
            });
          } catch (err) {
            console.warn('[operationsApi] Customer notification warning:', err);
          }
        }

        // LocalStorage fallback for customer
        try {
          const guestNotifs = JSON.parse(localStorage.getItem('sangoub_guest_notifications') || '[]');
          guestNotifs.unshift({
            id: `notif-${Date.now()}`,
            title: 'المندوب استلم طلبك وهو في الطريق إليك 🛵',
            body: `تم استلام طلبك رقم #${orderNum} من المتجر بواسطة ${courierName}.`,
            created_at: pickedUpAt,
            is_read: false,
            data: { orderId, status: 'with_courier' }
          });
          localStorage.setItem('sangoub_guest_notifications', JSON.stringify(guestNotifs.slice(0, 30)));
        } catch {}

        // 2. Notify Merchant in Supabase
        if (ord?.store_id) {
          try {
            const { data: merchants } = await supabase
              .from('profiles')
              .select('id')
              .or(`store_id.eq.${ord.store_id},role.eq.merchant`);

            if (merchants && merchants.length > 0) {
              const notifs = merchants.slice(0, 5).map(m => ({
                user_id: m.id,
                title: 'تم استلام الطلب من المحل 📦',
                body: `استلم ${courierName} الطلب رقم #${orderNum} بنجاح وانطلق لتسليمه للعميل.`,
                type: 'order',
                data: { orderId, status: 'with_courier' }
              }));
              await supabase.from('notifications').insert(notifs);
            }
          } catch (err) {
            console.warn('[operationsApi] Merchant notification warning:', err);
          }
        }

        return { ok: true, status: 'with_courier' };
      }
    }

    // -------------------------------------------------------------
    // Courier Depart / In Transit
    // -------------------------------------------------------------
    if (body.action === 'courier-depart' || body.action === 'depart') {
      const orderId = body.orderId || body.id;
      if (orderId) {
        const departedAt = new Date().toISOString();
        const { error: updErr } = await supabase.from('orders').update({
          status: 'with_courier',
          updated_at: departedAt
        }).eq('id', orderId);

        if (updErr) {
          console.warn('[operationsApi] courier-depart fallback:', updErr);
          await supabase.from('orders').update({
            status: 'picked_up',
            updated_at: departedAt
          }).eq('id', orderId);
        }

        const { data: ord } = await supabase
          .from('orders')
          .select('id, customer_id, order_number, courier_name')
          .eq('id', orderId)
          .maybeSingle();

        const orderNum = ord?.order_number || String(orderId).slice(0, 8);
        const courierName = ord?.courier_name || user.displayName || 'الكابتن';

        if (ord?.customer_id) {
          try {
            await supabase.from('notifications').insert({
              user_id: ord.customer_id,
              title: 'الكابتن في الطريق إليك 🛵',
              body: `${courierName} انطلق الآن لتوصيل طلبك رقم #${orderNum}. يرجى تجهيز رمز الاستلام.`,
              type: 'order',
              data: { orderId, status: 'with_courier' }
            });
          } catch {}
        }

        return { ok: true, status: 'with_courier' };
      }
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
      return { tasks: (orders || []).map((row: any) => mapOrderRow(row)), items: (orders || []).map((row: any) => mapOrderRow(row)) };
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
        const productIds = Array.from(new Set(
          (orders || []).flatMap((o: any) => o.order_items || []).map((i: any) => i.product_id).filter(Boolean)
        ));
        const productImgMap = new Map<string, string>();
        if (productIds.length > 0) {
          try {
            const { data: prods } = await supabase
              .from('products')
              .select('id, image_url')
              .in('id', productIds);
            if (prods) {
              for (const p of prods) {
                if (p.id && p.image_url) {
                  productImgMap.set(p.id, p.image_url);
                }
              }
            }
          } catch {}
        }
        return { items: (orders || []).map((row: any) => mapOrderRow(row, productImgMap)), nextCursor: null };
      } catch {
        return { items: [], nextCursor: null };
      }
    }

    if (body.action === 'update-profile') {
      // 1. Base updates strictly aligned with current Supabase profiles schema
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

      // Perform update with guaranteed columns
      const { error: baseErr } = await supabase
        .from('profiles')
        .update(baseUpdates)
        .eq('id', user.id);

      if (baseErr) {
        console.warn('[update-profile] Base update error, attempting minimal profile save:', baseErr.message);
        // Fallback to essential updates only
        await supabase
          .from('profiles')
          .update({
            full_name: baseUpdates.full_name || 'كابتن التوصيل',
            avatar_url: baseUpdates.avatar_url || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
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
    const persistContent = async (content: any) => {
      // 1. Try RPC first (SECURITY DEFINER, completely immune to RLS/permission issues)
      try {
        const { error: rpcErr } = await supabase.rpc('save_sangoub_app_content', { p_content: content });
        if (!rpcErr) {
          try {
            localStorage.setItem('sangoub_cached_app_content', JSON.stringify(content));
          } catch {}
          return;
        }
      } catch {}

      // 2. Direct upsert fallback
      const { error: upsertErr } = await supabase.from('app_content').upsert({ id: true, content });
      if (upsertErr) {
        console.warn('app_content upsert notice:', upsertErr);
        try {
          localStorage.setItem('sangoub_cached_app_content', JSON.stringify(content));
        } catch {}
        if (upsertErr.code === '42501' || (upsertErr as any).status === 403 || upsertErr.message?.includes('permission')) {
          throw new Error('PERMISSION_DENIED_APP_CONTENT');
        }
        throw upsertErr;
      }
      try {
        localStorage.setItem('sangoub_cached_app_content', JSON.stringify(content));
      } catch {}
    };

    const getStoredContent = async () => {
      let content: any = null;
      try {
        const { data: row } = await supabase.from('app_content').select('content').eq('id', true).maybeSingle();
        content = (row?.content && typeof row.content === 'object') ? row.content : null;
        if (typeof row?.content === 'string') {
          try { content = JSON.parse(row.content); } catch {}
        }
      } catch {}

      if (!content) {
        try {
          const cached = localStorage.getItem('sangoub_cached_app_content');
          if (cached) content = JSON.parse(cached);
        } catch {}
      }

      content = content || {};

      // Ensure config sections exist
      if (!content.config || !Array.isArray(content.config.sections)) {
        content.config = {
          ...defaultCustomerHome,
          ...(content.config || {}),
          sections: Array.isArray(content.config?.sections) && content.config.sections.length > 0
            ? content.config.sections
            : defaultCustomerHome.sections
        };
      }

      // Ensure campaigns/slides exist; if empty, initialize from DEFAULT_SANGOUB_BANNERS
      if (!Array.isArray(content.campaigns) || content.campaigns.length === 0) {
        content.campaigns = DEFAULT_SANGOUB_BANNERS.map((b, idx) => ({
          id: String(b.id || `slide-${idx + 1}`),
          title: b.title || '',
          subtitle: b.subtitle || '',
          imageUrl: b.imageUrl || b.image || '',
          enabled: true,
          priority: (idx + 1) * 10,
          targetType: b.targetType || 'offers',
          targetId: b.targetId || '',
          startsAt: new Date(Date.now() - 86400000).toISOString(),
          endsAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          hideOverlay: true,
          hideButton: true,
          btnText: '',
        }));
      }
      content.slides = content.campaigns;

      // Ensure gallery has initial default images
      if (!Array.isArray(content.gallery) || content.gallery.length === 0) {
        content.gallery = content.campaigns.map((c: any, i: number) => ({
          id: `gal-default-${i + 1}`,
          title: c.title || `شريحة ${i + 1}`,
          url: c.imageUrl,
          addedAt: new Date().toISOString(),
        }));
      }

      return content;
    };

    if (body.action === 'admin' || body.action === 'get') {
      const content = await getStoredContent();
      return {
        ok: true,
        config: content.config,
        campaigns: content.campaigns,
        slides: content.campaigns,
        gallery: content.gallery || [],
        productGallery: content.productGallery || [],
        martBanner: content.martBanner,
        disabledStoreTypes: content.disabledStoreTypes || [],
        disabledCategories: content.disabledCategories || [],
        categoryOverrides: content.categoryOverrides || {},
        operationsReady: true,
        operationsEnabled: true,
      };
    }

    if (body.action === 'save-campaign') {
      const content = await getStoredContent();
      const campaign = body.campaign;
      const targetId = body.id || campaign.id;
      const existingIdx = content.campaigns.findIndex((c: any) => c.id === targetId || c.id === campaign.id);
      if (existingIdx !== -1) {
        content.campaigns[existingIdx] = { ...content.campaigns[existingIdx], ...campaign, id: targetId };
      } else {
        content.campaigns.unshift({ ...campaign, id: targetId || `campaign-${Date.now()}` });
      }
      content.slides = content.campaigns;

      // Ensure new image is in gallery
      if (campaign.imageUrl && !content.gallery.some((g: any) => g.url === campaign.imageUrl)) {
        content.gallery.unshift({
          id: `gal-${Date.now()}`,
          title: campaign.title || 'شريحة سلايدر',
          url: campaign.imageUrl,
          addedAt: new Date().toISOString(),
        });
      }

      await persistContent(content);
      return { ok: true, campaigns: content.campaigns, slides: content.campaigns };
    }

    if (body.action === 'toggle-campaign') {
      const content = await getStoredContent();
      content.campaigns = content.campaigns.map((c: any) =>
        c.id === body.id ? { ...c, enabled: !c.enabled } : c
      );
      content.slides = content.campaigns;
      await persistContent(content);
      return { ok: true, campaigns: content.campaigns };
    }

    if (body.action === 'delete-campaign') {
      const content = await getStoredContent();
      content.campaigns = content.campaigns.filter((c: any) => c.id !== body.id);
      content.slides = content.campaigns;
      await persistContent(content);
      return { ok: true, campaigns: content.campaigns };
    }

    if (body.action === 'add-to-gallery') {
      const content = await getStoredContent();
      if (!Array.isArray(content.gallery)) content.gallery = [];
      content.gallery = [body.item, ...content.gallery.filter((g: any) => g.url !== body.item.url)];
      await persistContent(content);
      return { ok: true, gallery: content.gallery };
    }

    if (body.action === 'delete-from-gallery') {
      const content = await getStoredContent();
      if (Array.isArray(content.gallery)) {
        content.gallery = content.gallery.filter((g: any) => g.id !== body.id);
      }
      await persistContent(content);
      return { ok: true, gallery: content.gallery };
    }

    if (body.action === 'get-product-gallery') {
      const content = await getStoredContent();
      return { ok: true, productGallery: content.productGallery || [] };
    }

    if (body.action === 'add-product-gallery') {
      const content = await getStoredContent();
      if (!Array.isArray(content.productGallery)) content.productGallery = [];
      const newItems = Array.isArray(body.items) ? body.items : (body.item ? [body.item] : []);
      const newUrls = new Set(newItems.map((it: any) => it.url));
      content.productGallery = [...newItems, ...content.productGallery.filter((g: any) => !newUrls.has(g.url))];
      await persistContent(content);
      return { ok: true, productGallery: content.productGallery };
    }

    if (body.action === 'update-product-gallery') {
      const content = await getStoredContent();
      if (!Array.isArray(content.productGallery)) content.productGallery = [];
      const existingIdx = content.productGallery.findIndex((g: any) => g.id === body.id || (body.url && g.url === body.url));
      if (existingIdx !== -1) {
        content.productGallery[existingIdx] = {
          ...content.productGallery[existingIdx],
          title: body.title !== undefined ? body.title : content.productGallery[existingIdx].title,
          category: body.category !== undefined ? body.category : content.productGallery[existingIdx].category
        };
      } else if (body.id || body.url) {
        // If it was a catalog item being customized in the shared gallery
        content.productGallery.unshift({
          id: body.id || ('gal-prod-' + Date.now()),
          title: body.title || 'صنف في المعرض',
          url: body.url,
          category: body.category || 'grocery',
          isCustom: true,
          addedAt: new Date().toISOString()
        });
      }
      await persistContent(content);
      return { ok: true, productGallery: content.productGallery };
    }

    if (body.action === 'delete-product-gallery') {
      const content = await getStoredContent();
      if (Array.isArray(content.productGallery)) {
        content.productGallery = content.productGallery.filter((g: any) => g.id !== body.id);
      }
      await persistContent(content);
      return { ok: true, productGallery: content.productGallery };
    }

    if (body.action === 'save-mart-banner') {
      const content = await getStoredContent();
      content.martBanner = body.martBanner;
      await persistContent(content);
      return { ok: true, martBanner: content.martBanner };
    }

    if (body.action === 'save-home') {
      const content = await getStoredContent();
      content.config = body.config;
      await persistContent(content);
      return { ok: true, config: content.config };
    }

    if (body.action === 'save-category-config') {
      const content = await getStoredContent();
      content.disabledStoreTypes = body.disabledStoreTypes;
      content.disabledCategories = body.disabledCategories;
      content.categoryOverrides = body.categoryOverrides;
      await persistContent(content);
      return { ok: true };
    }

    if (body.action === 'save' || body.content) {
      await persistContent(body.content || body);
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
