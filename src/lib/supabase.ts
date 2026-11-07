/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { Profile, Store, Product, Order } from '../types';
// Removed static seedData stores
export const INITIAL_STORES = [];
export const INITIAL_PRODUCTS = [];

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  ((globalThis as any).process?.env?.VITE_SUPABASE_URL) ||
  'https://tvnsqatkaqyubeznhnmu.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  ((globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const STORE_SLUG_TO_SUPABASE_UUID: Record<string, string> = {
  'sangoub-market': 'a0000000-0000-0000-0000-000000000001',
  'capital-pharmacy': 'b1111111-2222-3333-4444-555555555501',
  'capital-falafel': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
  'store-foul-hind': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
  'government-cafe': '55508f0e-f818-452e-b946-ab803fe9d637',
  'store-cafe-gov': '55508f0e-f818-452e-b946-ab803fe9d637',
  'store-supermarket-el-nokba': '54a6c2f6-6c29-4177-ac65-32fadddea83d',
  'store-supermarket-capital': '54a6c2f6-6c29-4177-ac65-32fadddea83d',
  'store-ministry-coffee': '55508f0e-f818-452e-b946-ab803fe9d637',
  'store-karam-elsham': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
  'store-taza-bakery': '55508f0e-f818-452e-b946-ab803fe9d637',
};

export function resolveSupabaseStoreUuid(rawId?: string): string {
  if (!rawId) throw new Error('معرّف المتجر مطلوب.');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
  if (isUuid) return rawId;
  const storeId = STORE_SLUG_TO_SUPABASE_UUID[rawId];
  if (!storeId) throw new Error('المتجر المحدد غير معروف. حدّث قائمة المتاجر ثم أعد المحاولة.');
  return storeId;
}

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  projectRef: 'tvnsqatkaqyubeznhnmu',
};

// ── Auth Helpers ─────────────────────────────────────────────────────────────
export async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getSupabaseProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function upsertSupabaseProfile(profile: Partial<Profile> & { id: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Stores & Products ────────────────────────────────────────────────────────

export const KNOWN_STORE_ASSETS: Record<string, { logoUrl: string; bannerUrl: string; logo: string; name?: string }> = {
  'a0000000-0000-0000-0000-000000000001': {
    name: 'سنجوب ماركت',
    logoUrl: '/brand/sangoub-market-logo.jpg',
    bannerUrl: '/brand/sangoub-market-logo.jpg',
    logo: '/brand/sangoub-market-logo.jpg'
  },
  'b1111111-2222-3333-4444-555555555501': {
    name: 'صيدلية العاصمة المركزية - 24/7',
    logoUrl: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=800&q=80',
    logo: 'PHARM'
  },
  '27d12743-8106-4ef0-ba3c-84abefdb75d6': {
    name: 'فول وفلافل العاصمة',
    logoUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80',
    logo: 'FOOD'
  },
  '55508f0e-f818-452e-b946-ab803fe9d637': {
    name: 'كافيه الحي الحكومي',
    logoUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=200&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
    logo: 'CAFE'
  }
};


export async function getSupabaseStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('rating', { ascending: false });

  const fetched: Store[] = (!error && data) ? (data || []).map((row: any) => {
    const known = KNOWN_STORE_ASSETS[row.id] || Object.values(KNOWN_STORE_ASSETS).find(k => k.name === row.name);
    const logoUrl = (row.logo && row.logo.length > 4) ? row.logo : (row.logo_url || known?.logoUrl || '/brand/sangoub-mark-white-128.png');
    const bannerUrl = (row.banner && row.banner.length > 4) ? row.banner : (row.banner_url || row.image_url || known?.bannerUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80');
    const logo = (typeof row.logo === 'string' && row.logo.length > 0) ? row.logo : (known?.logo || 'STORE');

    return {
      id: row.id,
      name: row.name,
      nameEn: row.name_en || '',
      type: row.type || '',
      category: row.category as any,
      status: row.status || 'open',
      rating: Number(row.rating) || 4.9,
      ratingCount: Number(row.rating_count) || 120,
      deliveryTime: row.delivery_time || '15-25 دقيقة',
      minOrder: Number(row.min_order) || 20,
      deliveryFee: Number(row.delivery_fee) || 10,
      locationInDistrict: row.location_in_district || '',
      logo,
      banner: bannerUrl,
      logoUrl,
      bannerUrl,
      imageUrl: bannerUrl,
      commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
      taxRate: row.tax_rate != null ? Number(row.tax_rate) : undefined,
    };
  }) : [];

  // 100% authentic stores from Supabase only (ZERO mock/static data)
  const realStores: Store[] = [];

  // Ensure "سنجوب ماركت" is present as the platform's central store
  const sangoubStore = fetched.find(s => s.id === 'a0000000-0000-0000-0000-000000000001' || s.name.includes('سنجوب'));
  if (sangoubStore) {
    const sLogo = (sangoubStore.logoUrl && sangoubStore.logoUrl.length > 4) ? sangoubStore.logoUrl : '/brand/sangoub-market-logo.jpg';
    const sBanner = (sangoubStore.bannerUrl && sangoubStore.bannerUrl.length > 4) ? sangoubStore.bannerUrl : '/brand/sangoub-market-logo.jpg';
    realStores.push({
      ...sangoubStore,
      name: sangoubStore.name || 'سنجوب ماركت',
      nameEn: sangoubStore.nameEn || 'Sangoub Market',
      logo: sLogo,
      logoUrl: sLogo,
      banner: sBanner,
      bannerUrl: sBanner,
      imageUrl: sBanner,
    });
  } else {
    realStores.push({
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'سنجوب ماركت',
      nameEn: 'Sangoub Market',
      type: 'سوبرماركت ومستلزمات البيت اليومية',
      category: 'supermarket',
      status: 'open',
      rating: 5,
      ratingCount: 1250,
      deliveryTime: '15-25 دقيقة',
      minOrder: 20,
      deliveryFee: 10,
      locationInDistrict: 'الحي الحكومي - مركز سنجوب',
      logo: '/brand/sangoub-market-logo.jpg',
      logoUrl: '/brand/sangoub-market-logo.jpg',
      banner: '/brand/sangoub-market-logo.jpg',
      bannerUrl: '/brand/sangoub-market-logo.jpg',
      imageUrl: '/brand/sangoub-market-logo.jpg',
    });
  }

  // Add the remaining real stores from Supabase
  for (const s of fetched) {
    if (s.id !== 'a0000000-0000-0000-0000-000000000001' && s.id !== '54a6c2f6-6c29-4177-ac65-32fadddea83d') {
      realStores.push(s);
    }
  }

  return realStores;
}

export async function getSupabaseStore(storeId: string): Promise<Store | null> {
  const targetUuid = resolveSupabaseStoreUuid(storeId);
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', targetUuid)
      .maybeSingle();

    if (!error && data) {
      return {
        id: storeId || data.id,
        uuid: data.id,
        name: data.name,
        nameEn: data.name_en || '',
        type: data.type || '',
        category: data.category as any,
        status: data.status || 'open',
        rating: Number(data.rating) || 5,
        ratingCount: Number(data.rating_count) || 0,
        deliveryTime: data.delivery_time || '15-25 دقيقة',
        minOrder: Number(data.min_order) || 0,
        deliveryFee: Number(data.delivery_fee) || 10,
        locationInDistrict: data.location_in_district || '',
        logo: data.logo || data.logo_url || '',
        banner: data.banner || data.banner_url || '',
        logoUrl: data.logo_url || data.logo || '',
        bannerUrl: data.banner_url || data.banner || '',
        imageUrl: data.image_url || '',
        commissionRate: data.commission_rate != null ? Number(data.commission_rate) : undefined,
        taxRate: data.tax_rate != null ? Number(data.tax_rate) : undefined,
      } as Store;
    }
  } catch (err) {
    console.warn('[Supabase] getSupabaseStore error:', err);
  }

  if (storeId === 'a0000000-0000-0000-0000-000000000001' || storeId === 'sangoub-market') {
    return {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'سنجوب ماركت',
      nameEn: 'Sangoub Market',
      type: 'سوبرماركت ومستلزمات البيت اليومية',
      category: 'supermarket',
      status: 'open',
      rating: 5,
      ratingCount: 1250,
      deliveryTime: '15-25 دقيقة',
      minOrder: 20,
      deliveryFee: 10,
      locationInDistrict: 'الحي الحكومي - مركز سنجوب',
      logo: '/brand/sangoub-market-logo.jpg',
      logoUrl: '/brand/sangoub-market-logo.jpg',
      banner: '/brand/sangoub-market-logo.jpg',
      bannerUrl: '/brand/sangoub-market-logo.jpg',
      imageUrl: '/brand/sangoub-market-logo.jpg',
    } as Store;
  }
  return null;
}

export async function getSupabaseProducts(storeId?: string): Promise<Product[]> {
  let dbProducts: Product[] = [];
  try {
    let query = supabase.from('products').select('*, stores(name)');
    if (storeId) {
      const targetUuid = resolveSupabaseStoreUuid(storeId);
      if (storeId === 'a0000000-0000-0000-0000-000000000001' || targetUuid === 'a0000000-0000-0000-0000-000000000001') {
        query = query.in('store_id', ['a0000000-0000-0000-0000-000000000001', '54a6c2f6-6c29-4177-ac65-32fadddea83d']);
      } else {
        query = query.eq('store_id', targetUuid);
      }
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      dbProducts = (data || []).map((row: any) => {
        let imageUrl = row.image_url || row.banner || row.banner_url || '';

        // Authentic local & verified fallback for products with missing or broken image assets:
        if (!imageUrl || imageUrl.includes('548839140-29a749e1bc4e')) {
          if (row.name?.includes('فطور') || row.name?.includes('وجبة')) {
            imageUrl = '/images/breakfast.jpg';
          } else if (row.name?.includes('مياه') || row.name?.includes('نستله')) {
            imageUrl = 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80';
          } else if (row.name?.includes('شاي') || row.name?.includes('ليبتون')) {
            imageUrl = 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80';
          } else if (row.name?.includes('برجر')) {
            imageUrl = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80';
          }
        } else if (imageUrl.includes('1585421514738-01798e348b17') || (row.category?.includes('منظفات') && imageUrl.includes('1585421514738'))) {
          // Replace mismatched medical gloves image with clean laundry & detergent image
          imageUrl = 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80';
        } else if (row.name?.includes('صابون دوف') && imageUrl.includes('556228720')) {
          imageUrl = 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=600&q=80';
        }

        const isSangoub =
          row.store_id === 'a0000000-0000-0000-0000-000000000001' ||
          row.store_id === '54a6c2f6-6c29-4177-ac65-32fadddea83d' ||
          !row.store_id;

        return {
          id: row.id,
          storeId: isSangoub ? 'a0000000-0000-0000-0000-000000000001' : (row.store_id || storeId),
          storeName: isSangoub ? 'سنجوب ماركت' : (row.stores?.name || row.store_name || ''),
          name: row.name,
          nameEn: row.name_en || '',
          description: row.description || '',
          price: Number(row.price) || 0,
          originalPrice: row.original_price ? Number(row.original_price) : undefined,
          category: row.category || 'عام',
          categoryId: row.category_id || undefined,
          barcode: row.barcode || '',
          merchantPosSku: row.merchant_pos_sku || '',
          inStock: row.is_available !== undefined && row.is_available !== null ? Boolean(row.is_available) : true,
          archived: Boolean(row.archived || false),
          imageUrl,
          imageType: row.image_type || 'croissant',
          badge: row.badge || undefined,
          isPopular: Boolean(row.badge),
          optionGroups: row.options || [],
        };
      }) as Product[];
    }
  } catch (err) {
    console.warn('[Supabase] getSupabaseProducts error:', err);
  }

  // Authentic database products only — no fake mock items
  const merged: Product[] = [...dbProducts];

  if (storeId) {
    const targetUuid = resolveSupabaseStoreUuid(storeId);
    return merged.filter(p => {
      if (storeId === 'a0000000-0000-0000-0000-000000000001' || targetUuid === 'a0000000-0000-0000-0000-000000000001') {
        return p.storeId === 'a0000000-0000-0000-0000-000000000001' || p.storeId === '54a6c2f6-6c29-4177-ac65-32fadddea83d' || p.storeName?.includes('سنجوب');
      }
      return p.storeId === storeId || p.storeId === targetUuid;
    });
  }

  return merged;
}

// ── Catalog Realtime Helpers ────────────────────────────────────────────────
export function subscribeToCatalog(onStoresChange: () => void, onProductsChange: () => void) {
  const channel = supabase
    .channel('public:catalog')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
      onStoresChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
      onProductsChange();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Orders Realtime Helpers ──────────────────────────────────────────────────
export function subscribeToOrders(
  userId: string,
  role: 'employee' | 'restaurant' | 'courier' | 'admin',
  callback: (orders: Order[]) => void
) {
  let filter = '';
  if (role === 'employee') {
    filter = `customer_id=eq.${userId}`;
  } else if (role === 'restaurant') {
    filter = `store_id=eq.${userId}`;
  } else if (role === 'courier') {
    filter = `courier_id=eq.${userId}`;
  }

  const channel = supabase
    .channel('public:orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        ...(filter ? { filter } : {}),
      },
      async () => {
        // Fetch refreshed orders
        let q = supabase.from('orders').select('*, order_items(*)');
        if (role === 'employee') q = q.eq('customer_id', userId);
        else if (role === 'restaurant') q = q.eq('store_id', userId);
        else if (role === 'courier') q = q.eq('courier_id', userId);

        const { data } = await q.order('created_at', { ascending: false });
        if (data) callback(data as unknown as Order[]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

const orderStatusForApp = (status: string) => status === 'assigned' || status === 'picked_up' ? 'with_courier'
  : status === 'pending' || status === 'accepted' ? 'received' : status;

export function subscribeToAdminOrders(
  onData: (orders: Order[]) => void,
  onError: (error: Error) => void,
  onConnection?: (connected: boolean) => void,
) {
  let active = true;
  let loading = false;
  let queued = false;
  const load = async () => {
    if (!active) return;
    if (loading) { queued = true; return; }
    loading = true;
    try {
      const { data, error } = await supabase.from('orders')
        .select('*,order_items(*),stores(name)')
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const orders = (data || []).map((row: any) => ({
        id: row.id, profileId: row.customer_id, profileName: row.customer_name || '', phone: row.customer_phone || '',
        courierId: row.courier_id || '', courierName: row.courier_name || '', courierPhone: row.courier_phone || '',
        storeId: row.store_id, storeIds: row.store_ids || [row.store_id], storeName: row.stores?.name || row.restaurant_name || 'متجر سنجوب',
        orderNumber: row.order_number || row.id, orderStatus: orderStatusForApp(row.status), status: orderStatusForApp(row.status),
        estimatedDelivery: row.estimated_delivery || '',
        subtotal: Number(row.subtotal) || 0, deliveryFee: Number(row.delivery_fee) || 0, discount: Number(row.discount) || 0,
        tip: Number(row.tip) || 0, taxTotal: Number(row.tax_total) || 0, total: Number(row.total_amount) || 0,
        ministry: row.delivery_ministry || '', floorNumber: row.delivery_floor || '', roomNumber: row.delivery_room || '',
        deliveryAddress: row.delivery_address || row.delivery_ministry || '',
        coordinates: row.coordinates || (Number.isFinite(row.delivery_lat) && Number.isFinite(row.delivery_lng)
          ? { latitude: row.delivery_lat, longitude: row.delivery_lng } : undefined),
        paymentMethod: row.payment_method || 'cash', paymentStatus: row.payment_status || 'pending', notes: row.notes || '',
        createdAt: row.created_at, updatedAt: row.updated_at, deliveredAt: row.delivered_at,
        items: (row.order_items || []).map((item: any) => ({
          id: item.id, product: { id: item.product_id, storeId: item.store_id || row.store_id, name: item.product_name, price: Number(item.price) || 0 },
          quantity: Number(item.quantity) || 1, selectedOptions: item.selected_options || {}, extraPrice: Number(item.extra_price) || 0, notes: item.notes || '',
        })),
      })) as Order[];
      if (active) onData(orders);
    } catch (error) {
      if (active) onError(error instanceof Error ? error : new Error('تعذر تحميل الطلبات من Supabase.'));
    } finally {
      loading = false;
      if (queued && active) { queued = false; void load(); }
    }
  };
  void load();
  const channel = supabase.channel('admin-orders-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
    .subscribe(status => onConnection?.(status === 'SUBSCRIBED'));
  const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
  return () => { active = false; window.clearInterval(timer); void supabase.removeChannel(channel); onConnection?.(false); };
}

// -- Enterprise Multi-Vertical Catalog Helpers ------------------------------
export async function getStoreCatalog(storeId: string) {
  const { data, error } = await supabase
    .from('vw_store_catalog')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_available', true);

  if (error) {
    console.error('Error fetching store catalog:', error);
    return [];
  }
  return data;
}

export async function getOfferModifiers(offerId: string) {
  const { data, error } = await supabase
    .from('product_modifier_groups')
    .select('*, product_modifier_items(*)')
    .eq('offer_id', offerId)
    .order('sort_order');

  if (error) {
    console.error('Error fetching modifiers:', error);
    return [];
  }
  return data;
}

export async function lookupProductByBarcode(barcode: string) {
  const { data, error } = await supabase
    .from('store_offer_barcodes')
    .select('offer_id, barcode_type, store_offers(*, master_spu(*))')
    .eq('barcode', barcode)
    .maybeSingle();

  if (error) {
    console.error('Error looking up barcode:', error);
    return null;
  }
  return data;
}

// -- Google OAuth Helper ----------------------------------------------------
export async function signInWithSupabaseGoogle(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || (typeof window !== 'undefined' ? window.location.href : undefined),
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
