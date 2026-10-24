import type {
  Order,
  Product,
  Store,
  Coupon,
  CartItem,
} from "../src/types/index.ts";
export function buildOrder(
  input: any,
  uid: string,
  products: Map<string, Product>,
  stores: Map<string, Store>,
  coupon?: Coupon,
): Order & { storeIds: string[] } {
  if (
    !input ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 50
  )
    throw new Error("السلة غير صالحة.");
  const text = (key: string, max: number, required = true) => {
    const value = input[key];
    if (
      typeof value !== "string" ||
      value.trim().length > max ||
      (required && !value.trim())
    )
      throw new Error(`بيانات غير صالحة: ${key}`);
    return value.trim();
  };
  const allowedPaymentMethods = ["cash", "instapay", "vodafone_cash", "card", "wallet", "geidea"];
  const paymentMethod = input.paymentMethod || "cash";
  if (!allowedPaymentMethods.includes(paymentMethod))
    throw new Error("طريقة الدفع المختارة غير صالحة.");
  const items: CartItem[] = input.items.map((item: any, index: number) => {
    const product = products.get(item?.product?.id);
    const isOut = product?.inStock === false;
    if (
      !product ||
      isOut ||
      product.archived ||
      !Number.isFinite(product.price) ||
      product.price < 0
    )
      throw new Error("أحد الأصناف غير متاح. حدّث المنيو.");
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 50
    )
      throw new Error("كمية الصنف غير صالحة.");
    const selectedOptions = item.selectedOptions || {};
    if (typeof selectedOptions !== "object" || Array.isArray(selectedOptions))
      throw new Error("خيارات الصنف غير صالحة.");
    let extraPrice = 0;
    for (const key of Object.keys(selectedOptions))
      if (!product.optionGroups?.some((g) => g.title === key))
        throw new Error("خيار غير معروف.");
    for (const group of product.optionGroups || []) {
      const selected = selectedOptions[group.title];
      if (group.required && !selected) throw new Error(`اختر ${group.title}`);
      if (selected) {
        const option = group.options.find((o) => o.name === selected);
        if (!option || !Number.isFinite(option.price) || option.price < 0)
          throw new Error("خيار صنف غير صالح.");
        extraPrice += option.price;
      }
    }
    return {
      id: `item-${index}`,
      product,
      quantity: item.quantity,
      selectedOptions,
      extraPrice,
      notes: typeof item.notes === "string" ? item.notes.slice(0, 500) : "",
    };
  });
  const storeIds = [...new Set(items.map((item) => item.product.storeId))];
  let deliveryFee = 0;
  for (const id of storeIds) {
    const store = stores.get(id);
    if (
      !store ||
      store.status !== "open" ||
      !Number.isFinite(store.deliveryFee) ||
      store.deliveryFee < 0
    )
      throw new Error("أحد المتاجر لا يستقبل طلبات الآن.");
    const total = items
      .filter((i) => i.product.storeId === id)
      .reduce(
        (sum, i) => sum + (i.product.price + i.extraPrice) * i.quantity,
        0,
      );
    if (total < store.minOrder)
      throw new Error(
        `الحد الأدنى للطلب من ${store.name}: ${store.minOrder} جنيه`,
      );
    deliveryFee += store.deliveryFee;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round(
    items.reduce(
      (sum, i) => sum + (i.product.price + i.extraPrice) * i.quantity,
      0,
    ),
  );
  let discount = 0;
  if (input.couponCode) {
    if (
      !coupon ||
      coupon.code !== input.couponCode ||
      subtotal < coupon.minOrder ||
      !Number.isFinite(coupon.value) ||
      coupon.value < 0
    )
      throw new Error("كود الخصم غير صالح لهذا الطلب.");
    discount =
      coupon.discountType === "percent"
        ? Math.min(subtotal, (subtotal * coupon.value) / 100)
        : Math.min(subtotal, coupon.value);
  }
  const tip = input.tip ?? 0;
  if (!Number.isFinite(tip) || tip < 0 || tip > 1000)
    throw new Error("الإكرامية غير صالحة.");
  const total = round(subtotal + deliveryFee - discount + tip);
  if (total > 100000) throw new Error("قيمة الطلب تتجاوز الحد المسموح.");
  const phone = text("phone", 30);
  if (!/^(\+20|0)1[0125]\d{8}$/.test(phone))
    throw new Error("أدخل رقم هاتف مصري صحيح.");
  const coordinates = input.coordinates;
  if (
    coordinates &&
    (!Number.isFinite(coordinates.latitude) ||
      !Number.isFinite(coordinates.longitude) ||
      Math.abs(coordinates.latitude) > 90 ||
      Math.abs(coordinates.longitude) > 180)
  )
    throw new Error("إحداثيات غير صالحة.");
  return {
    id: input.id,
    orderNumber: `CAP-${input.id.slice(-8).toUpperCase()}`,
    profileId: uid,
    profileName: text("profileName", 120),
    phone,
    ministry: text("ministry", 120),
    floorNumber: text("floorNumber", 60),
    roomNumber: text("roomNumber", 80),
    items,
    storeIds,
    kitchenStatus: Object.fromEntries(storeIds.map((id) => [id, "received"])),
    itemsSummary: items.map((item) => `${item.product.name} (×${item.quantity})`).join("، "),
    restaurantName: storeIds.map((id) => stores.get(id)!.name).join("، "),
    subtotal,
    deliveryFee: round(deliveryFee),
    discount: round(discount),
    tip: round(tip),
    total,
    paymentMethod,
    paymentStatus: paymentMethod === "cash" ? "cash_on_delivery" : "pending",
    orderStatus: "received",
    createdAt: new Date().toISOString(),
    estimatedDelivery: "بانتظار تأكيد المتجر",
    ...(input.couponCode ? { couponCode: coupon!.code } : {}),
    ...(coordinates
      ? {
          coordinates: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          },
        }
      : {}),
    ...(input.isScheduled
      ? {
          isScheduled: true,
          scheduledDeliveryTime: text("scheduledDeliveryTime", 100),
        }
      : {}),
    notes: typeof input.notes === "string" ? input.notes.slice(0, 1000) : "",
  };
}
