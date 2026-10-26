import type {
  CartItem,
  Store,
  StoreOrderSnapshot,
} from "../src/types/index.ts";
export function orderTaxSnapshots(
  items: CartItem[],
  stores: Map<string, Store>,
  discount: number,
) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const subtotal = items.reduce(
    (sum, item) => sum + (item.product.price + item.extraPrice) * item.quantity,
    0,
  );
  const totals = new Map<string, number>();
  for (const item of items)
    totals.set(
      item.product.storeId,
      (totals.get(item.product.storeId) || 0) +
        (item.product.price + item.extraPrice) * item.quantity,
    );
  let allocated = 0;
  const entries = [...totals.entries()];
  const snapshots: StoreOrderSnapshot[] = entries.map(([id, gross], index) => {
    const store = stores.get(id)!;
    const rate = store.taxRate ?? 0;
    if (
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100 ||
      (rate > 0 && !store.taxRegistrationNumber?.trim())
    )
      throw new Error("راجع إعدادات ضريبة المتجر قبل إتمام الطلب.");
    const remaining = Math.max(0, round(discount - allocated));
    const share =
      index === entries.length - 1
        ? remaining
        : Math.min(
            remaining,
            round(subtotal ? (discount * gross) / subtotal : 0),
          );
    allocated = round(allocated + share);
    const net = Math.max(0, round(gross - share)),
      included = store.pricesIncludeTax !== false;
    const tax = round(
      included ? (net * rate) / (100 + rate) : (net * rate) / 100,
    );
    let logoUrl = "";
    try {
      const url = new URL(store.logoUrl || "");
      if (url.protocol === "https:" && !url.username && !url.password)
        logoUrl = url.href;
    } catch {
      /* Store name remains visible when no logo is configured. */
    }
    return {
      id,
      name: store.name,
      logoUrl,
      taxRate: rate,
      taxRegistrationNumber: store.taxRegistrationNumber || "",
      pricesIncludeTax: included,
      subtotal: round(gross),
      discount: share,
      deliveryFee: store.deliveryFee,
      taxTotal: tax,
      includedTax: included ? tax : 0,
      additionalTax: included ? 0 : tax,
      total: round(net + store.deliveryFee + (included ? 0 : tax)),
    };
  });
  return {
    storeSnapshots: snapshots,
    taxTotal: round(snapshots.reduce((sum, store) => sum + store.taxTotal, 0)),
    includedTax: round(
      snapshots.reduce((sum, store) => sum + store.includedTax, 0),
    ),
    additionalTax: round(
      snapshots.reduce((sum, store) => sum + store.additionalTax, 0),
    ),
  };
}
