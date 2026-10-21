import type { CartItem, Coupon, OrderStatus, Profile, Order, CourierChecklist } from '../types/index.ts';

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
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ج.م`;
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
      return { text: 'جاري التجهيز بالمطعم / المتجر', step: 2, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'with_courier':
      return { text: 'خرج مع مندوب الحي الحكومي', step: 4, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'ready':
      return { text: 'جاهز لاستلام المندوب', step: 3, colorClass: 'text-orange-700 bg-orange-50 border-orange-200' };
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
