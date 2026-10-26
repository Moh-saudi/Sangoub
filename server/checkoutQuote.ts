import { createHash } from "node:crypto";
import type { Order } from "../src/types/index.ts";
export function checkoutQuoteHash(order: Order) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        items: order.items.map((item) => ({
          id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          extraPrice: item.extraPrice,
          options: Object.entries(item.selectedOptions).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        })),
        taxTotal: order.taxTotal,
        additionalTax: order.additionalTax,
        includedTax: order.includedTax,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.paymentMethod,
      }),
    )
    .digest("hex");
}
