import type { Product, Store } from "../types";

export function hasProductOffer(product: Product): boolean {
  return Number.isFinite(product.price) && product.price >= 0 &&
    Number.isFinite(product.originalPrice) && product.originalPrice! > product.price;
}

export function productDiscountPercent(product: Product): number {
  return hasProductOffer(product) ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;
}

export function availableOffers(products: Product[], stores: Store[]): Product[] {
  const openStores = new Set(stores.filter(store => store.status === "open").map(store => store.id));
  return products.filter(product => hasProductOffer(product) && !product.archived && product.inStock && Boolean(product.name) && openStores.has(product.storeId));
}
