import type { Order, Product, StoreCategory } from "../types";

export const productCategories: Product["category"][] = [
  "فطور",
  "سندوتشات",
  "سوبر ماركت بالقطعة",
  "مشروبات",
  "وجبات خفيفة",
  "حلويات",
  "أدوية وصيدلية",
  "مستلزمات طبية",
  "منظفات وعناية بالمنزل",
];

export const storeCategories: [StoreCategory, string][] = [
  ["breakfast", "فطور"],
  ["sandwiches", "مطعم وسندوتشات"],
  ["supermarket", "سوبر ماركت"],
  ["cafe", "كافيه"],
  ["desserts", "حلويات"],
  ["pharmacy", "صيدلية وعناية طبية"],
];

export function catalogPerformance(orders: Order[]) {
  const result = new Map<string, { sold: number; revenue: number; pending: number }>();
  for (const order of orders) {
    if (order.orderStatus === "cancelled") continue;
    for (const item of order.items || []) {
      if (!item.product?.id) continue;
      const row = result.get(item.product.id) || { sold: 0, revenue: 0, pending: 0 };
      if (order.orderStatus === "delivered") {
        row.sold += item.quantity;
        row.revenue += (item.product.price + (item.extraPrice || 0)) * item.quantity;
      } else row.pending += item.quantity;
      result.set(item.product.id, row);
    }
  }
  return result;
}

export function productFormData(data: FormData, previous?: Product) {
  const name = String(data.get("name") || "").trim();
  const description = String(data.get("description") || "").trim();
  const price = Number(data.get("price"));
  const original = String(data.get("originalPrice") || "").trim();
  const originalPrice = original ? Number(original) : price;
  const category = String(data.get("category")) as Product["category"];
  const imageUrl = String(data.get("imageUrl") || "").trim();
  if (!name || name.length > 120 || !description || description.length > 1000) throw new Error("أدخل اسمًا ووصفًا صحيحين للصنف.");
  if (!Number.isFinite(price) || price < 0 || price > 100000 || !Number.isFinite(originalPrice) || originalPrice < price || originalPrice > 100000)
    throw new Error("راجع السعر؛ السعر قبل الخصم يجب ألا يقل عن سعر البيع.");
  if (!productCategories.includes(category)) throw new Error("اختر تصنيفًا صحيحًا.");
  if (imageUrl && new URL(imageUrl).protocol !== "https:") throw new Error("رابط الصورة يجب أن يستخدم HTTPS.");
  return {
    name, description, price, originalPrice, category, imageUrl,
    badge: String(data.get("badge") || "").trim().slice(0, 80),
    inStock: !previous?.archived && data.get("inStock") === "on",
    isPopular: data.get("isPopular") === "on",
  };
}
