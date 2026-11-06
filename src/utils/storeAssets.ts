import type { Store } from '../types';

/**
 * Returns the store's authentic logo directly from its own registered data.
 * Does not invent mock assets; strictly follows the database and dashboard.
 */
export function getStoreLogo(store: Partial<Store>): string {
  if (store.logoUrl && (store.logoUrl.startsWith('http') || store.logoUrl.startsWith('/'))) {
    return store.logoUrl;
  }
  if (store.logo && (store.logo.startsWith('http') || store.logo.startsWith('/'))) {
    return store.logo;
  }
  if (store.id === 'a0000000-0000-0000-0000-000000000001' || store.name?.includes('سنجوب')) {
    return '/brand/sangoub-market-logo.jpg';
  }
  return '/brand/sangoub-mark-white-128.png';
}

export const STORE_SLUG_MAP: Record<string, string> = {
  // Sangoub Market
  'a0000000-0000-0000-0000-000000000001': 'sangoub-market',
  'sangoub-market': 'a0000000-0000-0000-0000-000000000001',
  'sangoub': 'a0000000-0000-0000-0000-000000000001',

  // Capital Pharmacy
  'b1111111-2222-3333-4444-555555555501': 'capital-pharmacy',
  'capital-pharmacy': 'b1111111-2222-3333-4444-555555555501',

  // Capital Foul & Falafel
  '27d12743-8106-4ef0-ba3c-84abefdb75d6': 'capital-falafel',
  'capital-falafel': '27d12743-8106-4ef0-ba3c-84abefdb75d6',

  // Government District Cafe
  '55508f0e-f818-452e-b946-ab803fe9d637': 'government-cafe',
  'government-cafe': '55508f0e-f818-452e-b946-ab803fe9d637',
};

/**
 * Returns a clean, friendly URL slug for any store.
 * e.g. 'sangoub-market' instead of 'a0000000-0000-0000-0000-000000000001'
 */
export function getStoreSlug(storeOrId?: Partial<Store> | string): string {
  if (!storeOrId) return 'sangoub-market';
  const id = typeof storeOrId === 'string' ? storeOrId : storeOrId.id || '';
  const name = typeof storeOrId === 'object' ? storeOrId.name || '' : '';

  if (id === 'a0000000-0000-0000-0000-000000000001' || name.includes('سنجوب') || id.includes('sangoub')) {
    return 'sangoub-market';
  }
  if (STORE_SLUG_MAP[id]) {
    return STORE_SLUG_MAP[id];
  }
  if (name.includes('صيدلية')) return 'capital-pharmacy';
  if (name.includes('فول') || name.includes('فلافل')) return 'capital-falafel';
  if (name.includes('كافيه')) return 'government-cafe';

  return id;
}

/**
 * Resolves a store slug or UUID back to the database canonical ID.
 */
export function resolveStoreSlug(slugOrId: string): string {
  if (!slugOrId) return 'a0000000-0000-0000-0000-000000000001';
  if (slugOrId === 'sangoub-market' || slugOrId === 'sangoub' || slugOrId.includes('sangoub')) {
    return 'a0000000-0000-0000-0000-000000000001';
  }
  return STORE_SLUG_MAP[slugOrId] || slugOrId;
}

/**
 * Robust store ID comparator handling UUIDs, slugs, and Sangoub alias equivalence.
 */
export function matchStoreId(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const slugA = getStoreSlug(a);
  const slugB = getStoreSlug(b);
  if (slugA && slugB && slugA === slugB) return true;

  // Sangoub Market equivalence
  const isSangoubA = a === 'a0000000-0000-0000-0000-000000000001' || a === '54a6c2f6-6c29-4177-ac65-32fadddea83d' || slugA === 'sangoub-market';
  const isSangoubB = b === 'a0000000-0000-0000-0000-000000000001' || b === '54a6c2f6-6c29-4177-ac65-32fadddea83d' || slugB === 'sangoub-market';
  if (isSangoubA && isSangoubB) return true;

  return false;
}

/**
 * Returns a clean, friendly URL slug for any product.
 * Avoids ugly UUIDs or sku hashes in the URL bar.
 */
export function getProductSlug(productOrId?: { id?: string; name?: string; barcode?: string } | string): string {
  if (!productOrId) return '';
  if (typeof productOrId === 'string') {
    // If it's already a clean slug or barcode, keep it clean
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(productOrId) && !productOrId.startsWith('sku-')) {
      return encodeURIComponent(productOrId);
    }
    return productOrId;
  }

  const name = productOrId.name?.trim() || '';
  if (name) {
    const cleanName = name
      .replace(/[\/\\#,+()$~%.'":*?<>{}]/g, '')
      .replace(/—/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return encodeURIComponent(cleanName);
  }

  return productOrId.barcode || productOrId.id || '';
}

/**
 * Returns the store's authentic banner/cover image directly from its own registered data.
 */
export function getStoreImage(store: Partial<Store>): string {
  if (store.bannerUrl && (store.bannerUrl.startsWith('http') || store.bannerUrl.startsWith('/'))) {
    return store.bannerUrl;
  }
  if (store.imageUrl && (store.imageUrl.startsWith('http') || store.imageUrl.startsWith('/'))) {
    return store.imageUrl;
  }
  if (store.banner && (store.banner.startsWith('http') || store.banner.startsWith('/'))) {
    return store.banner;
  }
  return getStoreLogo(store);
}
