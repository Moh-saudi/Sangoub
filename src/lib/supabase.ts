/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { Profile, Store, Product, Order } from '../types';
import { INITIAL_STORES, INITIAL_PRODUCTS } from '../data/seedData.ts';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  ((globalThis as any).process?.env?.VITE_SUPABASE_URL) ||
  'https://tvnsqatkaqyubeznhnmu.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  ((globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI';

function isJwtExpired(token: string): boolean {
  try {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = typeof atob === 'function'
      ? decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
      : (globalThis as any).Buffer?.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonStr);
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return true;
    }
  } catch {}
  return false;
}

// Automatically purge expired Supabase auth tokens from localStorage on startup
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        const token = item?.access_token;
        if (token && isJwtExpired(token)) {
          console.warn('[Supabase] Clearing expired auth session from localStorage');
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}
}

const safeFetch: typeof fetch = async (input, init) => {
  const reqHeaders = new Headers(init?.headers || {});
  const authHeader = reqHeaders.get('Authorization') || reqHeaders.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && isJwtExpired(token)) {
      reqHeaders.set('Authorization', 'Bearer ' + supabaseAnonKey);
    }
  }

  const res = await fetch(input, { ...init, headers: reqHeaders });
  if (res.status === 401) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
            console.warn('[Supabase] Clearing expired auth session after 401');
            localStorage.removeItem(k);
          }
        }
      } catch {}
    }
    const retryHeaders = new Headers(reqHeaders);
    retryHeaders.set('Authorization', 'Bearer ' + supabaseAnonKey);
    retryHeaders.set('apikey', supabaseAnonKey);
    const retryRes = await fetch(input, { ...init, headers: retryHeaders });
    if (retryRes.ok) return retryRes;
  }
  return res;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: safeFetch,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const STORE_SLUG_TO_SUPABASE_UUID: Record<string, string> = {
  'store-foul-hind': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
  'store-supermarket-capital': '54a6c2f6-6c29-4177-ac65-32fadddea83d',
  'store-ministry-coffee': '55508f0e-f818-452e-b946-ab803fe9d637',
  'store-karam-elsham': '27d12743-8106-4ef0-ba3c-84abefdb75d6',
  'store-taza-bakery': '55508f0e-f818-452e-b946-ab803fe9d637',
};

export function resolveSupabaseStoreUuid(rawId?: string): string {
  if (!rawId) return '27d12743-8106-4ef0-ba3c-84abefdb75d6';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
  if (isUuid) return rawId;
  return STORE_SLUG_TO_SUPABASE_UUID[rawId] || '27d12743-8106-4ef0-ba3c-84abefdb75d6';
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
export async function getSupabaseStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('rating', { ascending: false });

  if (error) {
    console.error('Error fetching stores from Supabase:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en || '',
    type: row.type || '',
    category: row.category as any,
    status: row.status || 'open',
    rating: Number(row.rating) || 5,
    ratingCount: Number(row.rating_count) || 0,
    deliveryTime: row.delivery_time || '15-25 دقيقة',
    minOrder: Number(row.min_order) || 0,
    deliveryFee: Number(row.delivery_fee) || 10,
    locationInDistrict: row.location_in_district || '',
    logo: row.logo || row.logo_url || '',
    banner: row.banner || row.banner_url || '',
    logoUrl: row.logo_url || row.logo || '',
    bannerUrl: row.banner_url || row.banner || '',
    imageUrl: row.image_url || row.banner || row.banner_url || '',
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
    taxRate: row.tax_rate != null ? Number(row.tax_rate) : undefined,
  })) as Store[];
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

  // Graceful fallback from INITIAL_STORES so store preview never fails
  const fallback = INITIAL_STORES.find(s => s.id === storeId || s.id === targetUuid) || INITIAL_STORES[0];
  return fallback || null;
}

export async function getSupabaseProducts(storeId?: string): Promise<Product[]> {
  try {
    let query = supabase.from('products').select('*, stores(name)');
    if (storeId) {
      const targetUuid = resolveSupabaseStoreUuid(storeId);
      query = query.eq('store_id', targetUuid);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return (data || []).map((row: any) => ({
        id: row.id,
        storeId: storeId || row.store_id,
        storeName: row.stores?.name || 'صيدلية العاصمة المركزية - 24/7',
        name: row.name,
        nameEn: row.name_en || '',
        description: row.description || '',
        price: Number(row.price) || 0,
        originalPrice: row.original_price ? Number(row.original_price) : undefined,
        category: row.category || 'عام',
        categoryId: row.category_id || undefined,
        barcode: row.barcode || '',
        merchantPosSku: row.merchant_pos_sku || '',
        inStock: Boolean(row.is_available),
        archived: Boolean(row.archived),
        imageUrl: row.image_url || row.banner || row.banner_url || '',
        imageType: row.image_type || 'croissant',
        badge: row.badge || undefined,
        isPopular: Boolean(row.badge),
        optionGroups: row.options || [],
      })) as Product[];
    }
  } catch (err) {
    console.warn('[Supabase] getSupabaseProducts error:', err);
  }

  // Graceful fallback from INITIAL_PRODUCTS
  if (storeId) {
    const matched = INITIAL_PRODUCTS.filter(p => p.storeId === storeId);
    if (matched.length > 0) return matched;
  }
  return INITIAL_PRODUCTS;
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
