/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { Profile, Store, Product, Order } from '../types';

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
    imageUrl: row.image_url || '',
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
    taxRate: row.tax_rate != null ? Number(row.tax_rate) : undefined,
  })) as Store[];
}

export async function getSupabaseProducts(storeId?: string): Promise<Product[]> {
  let query = supabase.from('products').select('*, stores(name)');
  if (storeId) {
    query = query.eq('store_id', storeId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching products from Supabase:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    storeId: row.store_id,
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
    imageUrl: row.image_url || '',
    imageType: row.image_type || 'croissant',
    badge: row.badge || undefined,
    isPopular: Boolean(row.badge),
    optionGroups: row.options || [],
  })) as Product[];
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
