import type { Product, Store } from "../types";
import { matchStoreId } from "./storeAssets.ts";

export function hasProductOffer(product: Product): boolean {
  return Number.isFinite(product.price) && product.price >= 0 &&
    Number.isFinite(product.originalPrice) && product.originalPrice! > product.price;
}

export function productDiscountPercent(product: Product): number {
  return hasProductOffer(product) ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;
}

export function availableOffers(products: Product[], stores: Store[]): Product[] {
  const openStores = stores.filter(store => store.status === "open");
  const closedStores = stores.filter(store => store.status === "closed");

  return products.filter(product => {
    if (!hasProductOffer(product) || product.archived || !product.inStock || !product.name) {
      return false;
    }

    // 1. Strictly exclude offers of closed stores
    const isClosed = closedStores.some(s => matchStoreId(s.id, product.storeId) || s.id === product.storeId || (s.name && product.storeName === s.name));
    if (isClosed) return false;

    // 2. Must belong to an open store
    const isOpen = openStores.some(s => matchStoreId(s.id, product.storeId) || s.id === product.storeId || (s.name && product.storeName === s.name));
    if (isOpen) return true;

    // 3. Fallback: If product has no storeId and central Sangoub store is open, include it
    const sangoubStore = stores.find(s => s.id === 'a0000000-0000-0000-0000-000000000001' || s.name?.includes('سنجوب'));
    if (!product.storeId && sangoubStore?.status === 'open') return true;

    return false;
  });
}
