import test from "node:test";
import assert from "node:assert/strict";
import type { Order, Product } from "../types";
import { catalogPerformance, productFormData } from "./catalogManagement.ts";

test("catalog monitoring counts delivered snapshots and excludes cancelled orders", () => {
  const item = { product: { id: "real-product", price: 30 }, quantity: 2, extraPrice: 5 };
  const orders = [
    { orderStatus: "delivered", items: [item] },
    { orderStatus: "preparing", items: [item] },
    { orderStatus: "cancelled", items: [item] },
    { orderStatus: "delivered", items: [] },
  ] as unknown as Order[];
  assert.deepEqual(catalogPerformance(orders).get("real-product"), { sold: 2, revenue: 70, pending: 2 });
});
const form = () => {
  const data = new FormData();
  Object.entries({ name: "صنف اختبار", description: "وصف اختبار", price: "30", category: "مشروبات", imageUrl: "https://images.example.com/item.webp", inStock: "on" }).forEach(([key,value]) => data.set(key,value));
  return data;
};
test("editing archived items cannot silently make them available", () => {
  assert.equal(productFormData(form(), { archived: true } as Product).inStock, false);
  assert.equal(productFormData(form()).inStock, true);
});
test("catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices", () => {
  for (const [field,value] of [["price", "NaN"], ["originalPrice", "20"], ["imageUrl", "javascript:alert(1)"], ["category", "unknown"]]) {
    const data = form(); data.set(field,value);
    assert.throws(() => productFormData(data));
  }
});
