import type { CartItem } from "../types";
import type { CartLine } from "./cartState";
export const storefrontCartKey = "sangoub_cart_items_v2";
export const checkoutCartKey = "sangoub-web-cart-v1";
/** Only product identities/options cross the boundary; checkout reloads authoritative prices. */
export function checkoutLines(items: CartItem[]): CartLine[] {
  if (
    !items.length ||
    items.length > 50 ||
    new Set(items.map((item) => item.product.storeId)).size !== 1
  )
    throw new Error(
      "اختر منتجات متجر واحد لكل طلب. يمكنك إكمال طلب ثم بدء طلب متجر آخر.",
    );
  return items.map((item) => {
    if (
      !/^[\w-]{1,128}$/.test(item.product.id) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 50
    )
      throw new Error("راجع المنتجات والكميات قبل المتابعة.");
    return {
      id: item.id,
      productId: item.product.id,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions || {},
      notes: item.notes || "",
    };
  });
}
export function consumeStorefrontCart(purchased: CartLine[]) {
  try {
    const source = JSON.parse(localStorage.getItem(storefrontCartKey) || "[]");
    if (!Array.isArray(source)) return;
    const paid = new Map(purchased.map((line) => [line.id, line]));
    const next = source.flatMap((item: CartItem) => {
      const line = paid.get(item.id);
      if (!line || line.productId !== item.product?.id) return [item];
      const quantity = Math.max(0, item.quantity - line.quantity);
      return quantity ? [{ ...item, quantity }] : [];
    });
    localStorage.setItem(storefrontCartKey, JSON.stringify(next));
  } catch {
    /* Successful server acknowledgment is never reversed by blocked browser storage. */
  }
}
