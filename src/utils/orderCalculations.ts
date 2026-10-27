import type {
  CartItem,
  Coupon,
  OrderStatus,
  Profile,
  Order,
  CourierChecklist,
  PaymentMethod,
  MerchantJournalEntry,
  MerchantAccountingSummary,
  TopSellingItem,
  CourierRadarProfile,
  Coordinates,
} from '../types/index.ts';

/**
 * Calculates cart subtotal based on item base price + option extra prices * quantity.
 */
export function calculateCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemUnitPrice = item.product.price + (item.extraPrice || 0);
    return sum + itemUnitPrice * item.quantity;
  }, 0);
}

/**
 * Applies coupon discount.
 */
export function applyCouponDiscount(
  subtotal: number,
  coupon: Coupon | null
): { discount: number; error?: string } {
  if (!coupon) {
    return { discount: 0 };
  }

  if (subtotal < coupon.minOrder) {
    return {
      discount: 0,
      error: `الحد الأدنى لتطبيق هذه القسيمة هو ${coupon.minOrder} ج.م (قيمة سلتك الحالية ${subtotal} ج.م)`,
    };
  }

  let discount = 0;
  if (coupon.discountType === 'fixed') {
    discount = Math.min(coupon.value, subtotal);
  } else if (coupon.discountType === 'percent') {
    discount = Math.round((subtotal * coupon.value) / 100);
  }

  return { discount };
}

/**
 * Calculates overall order total including subtotal, delivery fee, discount, and tip.
 */
export function calculateOrderTotal(
  subtotal: number,
  deliveryFee: number,
  discount: number,
  tip: number = 0
): number {
  const afterDiscount = Math.max(0, subtotal - discount);
  return afterDiscount + deliveryFee + Math.max(0, tip);
}

/**
 * Formats Egyptian Pound with Arabic localized text.
 */
export function formatEGP(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ج.م`;
}

/**
 * Sanitizes delivery addresses to always show legible Arabic street & district names,
 * never raw coordinates or raw '(lat, lng)' strings.
 */
export function cleanDisplayAddress(addr?: string): string {
  if (!addr || !addr.trim()) return 'شارع المهندس ابراهيم عثمان، الشروق';
  const trimmed = addr.trim();
  // If it's literally coordinates or matches '(30.' or contains number, number coordinate pairs
  if (
    trimmed.includes('موقعك الحالي') ||
    /\(?\d{2}\.\d+.*,\s*\d{2}\.\d+\)?/.test(trimmed) ||
    trimmed === 'default_map'
  ) {
    return 'شارع المهندس ابراهيم عثمان، الشروق';
  }
  return trimmed;
}

/**
 * Gets next status in lifecycle.
 */
export function getNextOrderStatus(current: OrderStatus): OrderStatus {
  switch (current) {
    case 'received':
      return 'preparing';
    case 'preparing':
      return 'ready';
    case 'ready':
      return 'with_courier';
    case 'with_courier':
      return 'delivered';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'received';
  }
}

/**
 * Get readable Arabic label for order status
 */
export function getOrderStatusLabel(status: OrderStatus): { text: string; step: number; colorClass: string } {
  switch (status) {
    case 'received':
      return { text: 'تم استلام الطلب بنجاح', step: 1, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' };
    case 'preparing':
      return { text: 'مقبول وجاري التحضير بالمطعم', step: 2, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'with_courier':
      return { text: 'تم التسليم للمندوب وهو في الطريق إليك', step: 4, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'ready':
      return { text: 'جاهز للاستلام بالمطعم', step: 3, colorClass: 'text-orange-700 bg-orange-50 border-orange-200' };
    case 'delivered':
      return { text: 'تم التسليم لمكتب الوزارة بنجاح', step: 5, colorClass: 'text-teal-700 bg-teal-50 border-teal-200' };
    case 'cancelled':
      return { text: 'تم إلغاء الطلب', step: 0, colorClass: 'text-rose-600 bg-rose-50 border-rose-200' };
    default:
      return { text: 'قيد المعالجة', step: 1, colorClass: 'text-slate-600 bg-slate-50 border-slate-200' };
  }
}

/**
 * Updates courier milestone and determines if order is delivered
 */
export function updateCourierMilestone(
  order: Order,
  milestone: 'received_checked' | 'paid_restaurant' | 'on_the_way' | 'arrived_office' | 'collected_payment'
): Order {
  const currentChecklist: CourierChecklist = order.courierChecklist || {
    receivedAndCheckedAtRestaurant: false,
    paidRestaurant: false,
    onTheWayToMinistry: false,
    arrivedAtCustomerOffice: false,
    collectedPayment: false,
  };

  const updated: CourierChecklist = { ...currentChecklist };

  if (milestone === 'received_checked') {
    updated.receivedAndCheckedAtRestaurant = true;
  } else if (milestone === 'paid_restaurant') {
    updated.paidRestaurant = true;
  } else if (milestone === 'on_the_way') {
    updated.onTheWayToMinistry = true;
  } else if (milestone === 'arrived_office') {
    updated.arrivedAtCustomerOffice = true;
  } else if (milestone === 'collected_payment') {
    updated.collectedPayment = true;
  }

  // Determine overall orderStatus
  let newOrderStatus: OrderStatus = order.orderStatus;
  if (updated.collectedPayment && updated.arrivedAtCustomerOffice) {
    newOrderStatus = 'delivered';
  } else if (updated.onTheWayToMinistry || updated.receivedAndCheckedAtRestaurant) {
    newOrderStatus = 'with_courier';
  }

  return {
    ...order,
    orderStatus: newOrderStatus,
    courierChecklist: updated,
    paymentStatus: updated.collectedPayment ? 'paid' : order.paymentStatus,
  };
}

/**
 * Validates employee checkout profile
 */
export function validateEmployeeProfile(profile: Partial<Profile>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!profile.fullName || profile.fullName.trim().length < 3) {
    errors.push('يرجى إدخال الاسم بالكامل');
  }

  if (!profile.phone || !/^(01[0125][0-9]{8})$/.test(profile.phone.replace(/\s+/g, ''))) {
    errors.push('يرجى إدخال رقم هاتف مصري صحيح (11 رقم)');
  }

  if (!profile.ministry || profile.ministry.trim().length === 0) {
    errors.push('يرجى تحديد الوزارة أو الهيئة التابع لها');
  }

  if (!profile.floorNumber || profile.floorNumber.trim().length === 0) {
    errors.push('يرجى إدخال رقم الدور بالحي الحكومي');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates financial summary and breakdown by payment method for a merchant/store
 */
export function calculateMerchantAccountingSummary(
  orders: Order[],
  storeId: string,
  commissionRate: number = 0.10
): MerchantAccountingSummary {
  const storeOrders = orders.filter((order) => {
    const isStoreOrder = order.storeIds?.includes(storeId) ||
      order.items?.some((i) => i.product.storeId === storeId);
    return isStoreOrder && order.orderStatus === 'delivered';
  });

  let grossSales = 0;
  let taxAmount = 0;
  let cashTotal = 0;
  let instapayTotal = 0;
  let geideaTotal = 0;

  for (const order of storeOrders) {
    const storeSubtotal = order.items
      .filter((i) => i.product.storeId === storeId)
      .reduce((sum, item) => sum + (item.product.price + (item.extraPrice || 0)) * item.quantity, 0);

    grossSales += storeSubtotal;

    if (order.taxTotal && order.subtotal > 0) {
      taxAmount += (storeSubtotal / order.subtotal) * order.taxTotal;
    }

    if (order.paymentMethod === 'cash') {
      cashTotal += storeSubtotal;
    } else if (order.paymentMethod === 'instapay') {
      instapayTotal += storeSubtotal;
    } else {
      geideaTotal += storeSubtotal;
    }
  }

  const platformCommission = Math.round(grossSales * commissionRate * 100) / 100;
  const netPayout = Math.max(0, grossSales - platformCommission);

  return {
    grossSales,
    platformCommission,
    taxAmount: Math.round(taxAmount * 100) / 100,
    netPayout,
    ordersCount: storeOrders.length,
    byPaymentMethod: {
      cash: cashTotal,
      instapay: instapayTotal,
      geidea: geideaTotal,
    },
  };
}

/**
 * Generates automated double-entry accounting journal entries for a merchant's delivered orders
 */
export function generateMerchantJournalEntries(
  orders: Order[],
  storeId: string,
  commissionRate: number = 0.10
): MerchantJournalEntry[] {
  const deliveredStoreOrders = orders.filter((order) => {
    const isStoreOrder = order.storeIds?.includes(storeId) ||
      order.items?.some((i) => i.product.storeId === storeId);
    return isStoreOrder && order.orderStatus === 'delivered';
  });

  const entries: MerchantJournalEntry[] = [];

  for (const order of deliveredStoreOrders) {
    const storeSubtotal = order.items
      .filter((i) => i.product.storeId === storeId)
      .reduce((sum, item) => sum + (item.product.price + (item.extraPrice || 0)) * item.quantity, 0);

    if (storeSubtotal <= 0) continue;

    const commission = Math.round(storeSubtotal * commissionRate * 100) / 100;

    let debitAccount = 'حـ/ الصندوق النقدي (عهدة مندوب الحي)';
    if (order.paymentMethod === 'geidea') {
      debitAccount = 'حـ/ وسيط الدفع الإلكتروني (Geidea / بطاقة)';
    } else if (order.paymentMethod === 'instapay') {
      debitAccount = 'حـ/ التحويل المباشر (InstaPay)';
    }

    // 1. Sales Recognition Entry
    entries.push({
      id: `JE-${order.id}-01`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      date: order.deliveredAt || order.createdAt || new Date().toISOString(),
      debitAccount,
      creditAccount: 'حـ/ إيرادات مبيعات المتجر',
      amount: storeSubtotal,
      statement: `إثبات مبيعات الطلب #${order.orderNumber} عبر ${order.paymentMethod === 'cash' ? 'نقدي (كاش)' : order.paymentMethod === 'geidea' ? 'بطاقة بنكية' : 'إنستاباي'}`,
      paymentMethod: order.paymentMethod,
    });

    // 2. Platform Commission Expense Entry
    if (commission > 0) {
      entries.push({
        id: `JE-${order.id}-02`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        date: order.deliveredAt || order.createdAt || new Date().toISOString(),
        debitAccount: 'حـ/ مصروف عمولة تشغيل المنصة',
        creditAccount: 'حـ/ أمانات منصة طلبات العاصمة الدائنة',
        amount: commission,
        statement: `خصم عمولة المنصة (${Math.round(commissionRate * 100)}%) للطلب #${order.orderNumber}`,
        paymentMethod: order.paymentMethod,
      });
    }
  }

  return entries.reverse(); // Newest first
}

/**
 * Calculates best-selling items for a merchant
 */
export function calculateTopSellingProducts(
  orders: Order[],
  storeId: string,
  limit: number = 5
): TopSellingItem[] {
  const deliveredStoreOrders = orders.filter((order) => {
    const isStoreOrder = order.storeIds?.includes(storeId) ||
      order.items?.some((i) => i.product.storeId === storeId);
    return isStoreOrder && order.orderStatus === 'delivered';
  });

  const statsMap: Record<string, { name: string; category: string; quantity: number; revenue: number; orderIds: Set<string> }> = {};
  let totalRevenueAll = 0;

  for (const order of deliveredStoreOrders) {
    for (const item of order.items) {
      if (item.product.storeId !== storeId) continue;
      const pid = item.product.id;
      const itemPrice = item.product.price + (item.extraPrice || 0);
      const itemTotal = itemPrice * item.quantity;
      totalRevenueAll += itemTotal;

      if (!statsMap[pid]) {
        statsMap[pid] = {
          name: item.product.name,
          category: item.product.category,
          quantity: 0,
          revenue: 0,
          orderIds: new Set(),
        };
      }

      statsMap[pid].quantity += item.quantity;
      statsMap[pid].revenue += itemTotal;
      statsMap[pid].orderIds.add(order.id);
    }
  }

  const itemsArray: TopSellingItem[] = Object.entries(statsMap).map(([productId, data]) => ({
    productId,
    name: data.name,
    category: data.category,
    soldQuantity: data.quantity,
    totalRevenue: data.revenue,
    ordersCount: data.orderIds.size,
    percentageShare: totalRevenueAll > 0 ? Math.round((data.revenue / totalRevenueAll) * 100) : 0,
  }));

  // Sort by sold quantity descending
  return itemsArray.sort((a, b) => b.soldQuantity - a.soldQuantity).slice(0, limit);
}

/**
 * Calculates geographic distance in kilometers (Haversine formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Ranks couriers by proximity to the store and highlights the fastest courier
 */
export function rankCouriersForStore(
  storeCoords: Coordinates | { latitude?: number; longitude?: number },
  couriersList: Array<{
    id: string;
    name: string;
    phone: string;
    rating?: number;
    avgDeliveryMinutes?: number;
    coordinates?: Coordinates;
    status?: 'available' | 'busy' | 'offline';
  }>
): CourierRadarProfile[] {
  const sLat = storeCoords?.latitude ?? 30.0131; // Default New Admin Capital
  const sLng = storeCoords?.longitude ?? 31.7346;

  const ranked: CourierRadarProfile[] = couriersList.map((c, index) => {
    const cLat = c.coordinates?.latitude ?? (sLat + (index + 1) * 0.005);
    const cLng = c.coordinates?.longitude ?? (sLng + (index + 1) * 0.004);
    const distanceKm = calculateDistanceKm(sLat, sLng, cLat, cLng);
    const avgDeliveryMinutes = c.avgDeliveryMinutes ?? (12 + index * 4);

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      rating: c.rating ?? 4.9,
      avgDeliveryMinutes,
      distanceKm,
      isFastest: false,
      status: c.status ?? 'available',
      coordinates: { latitude: cLat, longitude: cLng },
    };
  });

  if (ranked.length > 0) {
    const minTime = Math.min(...ranked.map((r) => r.avgDeliveryMinutes));
    ranked.forEach((r) => {
      if (r.avgDeliveryMinutes === minTime) {
        r.isFastest = true;
      }
    });
  }

  // Sort primarily by closest distance
  return ranked.sort((a, b) => a.distanceKm - b.distanceKm);
}
