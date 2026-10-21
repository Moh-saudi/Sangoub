import type { Order } from "../types/index.ts";

export function isoDate(value: any): string {
  if (value?.toDate) value = value.toDate();
  else if (value && typeof value.seconds === "number") value = new Date(value.seconds * 1000);
  if (!(typeof value === "string" || value instanceof Date)) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function normalizeOrder(data: any): Order {
  const canonical = Array.isArray(data.items) && data.items.every((item: any) => item?.product && typeof item.product.storeId === "string");
  return {
    ...data,
    items: canonical ? data.items : [],
    legacyRecord: !canonical,
    legacySummary: !canonical ? data.itemsSummary || "تفاصيل الأصناف غير محفوظة في هذا السجل" : undefined,
    subtotal: Number.isFinite(data.subtotal) ? data.subtotal : 0,
    deliveryFee: Number.isFinite(data.deliveryFee) ? data.deliveryFee : 0,
    discount: Number.isFinite(data.discount) ? data.discount : 0,
    tip: Number.isFinite(data.tip) ? data.tip : 0,
    total: Number.isFinite(data.total) ? data.total : 0,
    paymentStatus: data.paymentStatus || "pending",
    createdAt: isoDate(data.createdAt),
    updatedAt: isoDate(data.updatedAt),
    readyAt: isoDate(data.readyAt),
    deliveredAt: isoDate(data.deliveredAt),
    estimatedDelivery: data.estimatedDelivery || "لم يحدد بعد",
  };
}

export function kitchenStage(order: Order, storeId: string) {
  return order.kitchenStatus?.[storeId] ||
    (order.orderStatus === "ready" ? "ready" : order.orderStatus === "preparing" ? "preparing" : "received");
}

export function nextKitchenUpdate(order: Order, storeId: string, next: "preparing" | "ready") {
  if (!order.storeIds?.includes(storeId) || !["received", "preparing"].includes(order.orderStatus))
    throw new Error("هذا الطلب غير متاح للتحضير في هذا المتجر.");
  const previous = kitchenStage(order, storeId);
  if ((next === "preparing" && previous !== "received") || (next === "ready" && previous !== "preparing"))
    throw new Error("تغيرت حالة الطلب؛ راجع أحدث تحديث.");
  const kitchenStatus = { ...order.kitchenStatus, [storeId]: next };
  const ready = order.storeIds.every((id) => kitchenStatus[id] === "ready");
  return { kitchenStatus, orderStatus: ready ? "ready" as const : "preparing" as const };
}

export function cairoDay(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((part) => parts.find((p) => p.type === part)?.value).join("-");
}

export function dailyOperations(orders: Order[], day: string) {
  const created = orders.filter((o) => Boolean(day) && cairoDay(o.createdAt) === day);
  const delivered = orders.filter((o) => Boolean(day) && o.orderStatus === "delivered" && cairoDay(o.deliveredAt || "") === day);
  return {
    created, delivered,
    active: orders.filter((o) => !["delivered", "cancelled"].includes(o.orderStatus)),
    deliveredValue: delivered.reduce((sum, o) => sum + o.total, 0),
    deliveryRate: created.length ? Math.round(created.filter((o) => o.orderStatus === "delivered").length / created.length * 100) : 0,
    missingDeliveryTime: orders.filter((o) => o.orderStatus === "delivered" && !o.deliveredAt).length,
  };
}
