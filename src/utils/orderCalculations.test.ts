import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartSubtotal,
  applyCouponDiscount,
  calculateOrderTotal,
  getNextOrderStatus,
  validateEmployeeProfile,
  updateCourierMilestone,
} from './orderCalculations.ts';
import type { CartItem, Coupon } from '../types/index.ts';

test('calculateCartSubtotal correctly sums prices with quantities and options', () => {
  const items: CartItem[] = [
    {
      id: 'item-1',
      product: {
        id: 'p1',
        storeId: 's1',
        storeName: 'فول هند',
        name: 'سندوتش فول مخصوص بالخلطة',
        description: 'فول مع زيت حار وطحينة',
        price: 15,
        category: 'فطور',
        imageType: 'foul',
        inStock: true,
      },
      quantity: 3,
      selectedOptions: { 'إضافات': 'طحينة إضافية' },
      extraPrice: 3,
    },
    {
      id: 'item-2',
      product: {
        id: 'p2',
        storeId: 's2',
        storeName: 'سوبرماركت العاصمة',
        name: 'زجاجة مياه معدنية 1.5 لتر',
        description: 'مياه طبيعية نقية',
        price: 10,
        category: 'سوبر ماركت بالقطعة',
        imageType: 'water',
        inStock: true,
      },
      quantity: 2,
      selectedOptions: {},
      extraPrice: 0,
    },
  ];

  // item 1: (15 + 3) * 3 = 54
  // item 2: (10 + 0) * 2 = 20
  // total = 74
  const subtotal = calculateCartSubtotal(items);
  assert.equal(subtotal, 74);
});

test('applyCouponDiscount handles minOrder thresholds and discount calculation', () => {
  const couponFixed: Coupon = {
    code: 'GOV100',
    discountType: 'fixed',
    value: 100,
    minOrder: 250,
    title: 'خصم 100 ج.م لموظفي الحي الحكومي',
    description: 'خصم 100 ج.م عند الطلب بـ 250 ج.م أو أكثر',
  };

  // Below min order
  const belowResult = applyCouponDiscount(200, couponFixed);
  assert.equal(belowResult.discount, 0);
  assert.match(belowResult.error || '', /الحد الأدنى/);

  // Equal or above min order
  const validResult = applyCouponDiscount(300, couponFixed);
  assert.equal(validResult.discount, 100);

  // Percentage coupon
  const couponPercent: Coupon = {
    code: 'CAPITAL20',
    discountType: 'percent',
    value: 20,
    minOrder: 100,
    title: 'خصم 20%',
    description: 'خصم 20% بحد أدنى 100 ج.م',
  };

  const percentResult = applyCouponDiscount(200, couponPercent);
  assert.equal(percentResult.discount, 40);
});

test('calculateOrderTotal applies discount, delivery fee, and tip properly', () => {
  // subtotal 200, delivery 15, discount 50, tip 10 -> (200 - 50) + 15 + 10 = 175
  const total = calculateOrderTotal(200, 15, 50, 10);
  assert.equal(total, 175);
});

test('getNextOrderStatus advances status correctly', () => {
  assert.equal(getNextOrderStatus('received'), 'preparing');
  assert.equal(getNextOrderStatus('preparing'), 'with_courier');
  assert.equal(getNextOrderStatus('with_courier'), 'delivered');
  assert.equal(getNextOrderStatus('delivered'), 'delivered');
});

test('validateEmployeeProfile validates name, Egyptian phone, ministry and floor', () => {
  const invalid = validateEmployeeProfile({
    fullName: 'أح',
    phone: '1234',
    ministry: '',
    floorNumber: '',
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 4);

  const valid = validateEmployeeProfile({
    fullName: 'م. أحمد خالد عبد الرحمن',
    phone: '01012345678',
    ministry: 'وزارة النقل',
    floorNumber: 'الدور الخامس - مكتب 502',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});

test('updateCourierMilestone updates checklist and advances to delivered when completed', () => {
  const baseOrder: any = {
    id: 'ord-test',
    orderNumber: 'CAP-1111',
    orderStatus: 'received',
    total: 80,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
  };

  const step1 = updateCourierMilestone(baseOrder, 'received_checked');
  assert.equal(step1.courierChecklist?.receivedAndCheckedAtRestaurant, true);
  assert.equal(step1.orderStatus, 'with_courier');

  const step2 = updateCourierMilestone(step1, 'paid_restaurant');
  assert.equal(step2.courierChecklist?.paidRestaurant, true);

  const step3 = updateCourierMilestone(step2, 'on_the_way');
  assert.equal(step3.courierChecklist?.onTheWayToMinistry, true);

  const step4 = updateCourierMilestone(step3, 'arrived_office');
  assert.equal(step4.courierChecklist?.arrivedAtCustomerOffice, true);

  const step5 = updateCourierMilestone(step4, 'collected_payment');
  assert.equal(step5.courierChecklist?.collectedPayment, true);
  assert.equal(step5.orderStatus, 'delivered');
  assert.equal(step5.paymentStatus, 'paid');
});
