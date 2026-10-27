import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEGP,
  calculateCartSubtotal,
  applyCouponDiscount,
  calculateOrderTotal,
  getNextOrderStatus,
  validateEmployeeProfile,
  updateCourierMilestone,
  calculateMerchantAccountingSummary,
  generateMerchantJournalEntries,
  calculateTopSellingProducts,
  calculateDistanceKm,
  rankCouriersForStore,
} from './orderCalculations.ts';
import type { CartItem, Coupon, Order } from '../types/index.ts';

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
  assert.equal(getNextOrderStatus('preparing'), 'ready');
  assert.equal(getNextOrderStatus('ready'), 'with_courier');
  assert.equal(getNextOrderStatus('with_courier'), 'delivered');
  assert.equal(getNextOrderStatus('delivered'), 'delivered');
  assert.equal(getNextOrderStatus('cancelled'), 'cancelled');
});

test('validateEmployeeProfile validates name, Egyptian phone, ministry and floor', () => {
  const invalid = validateEmployeeProfile({
    fullName: '',
    phone: '123',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 3);

  const valid = validateEmployeeProfile({
    fullName: 'أحمد محمود إسماعيل',
    phone: '01012345678',
    ministry: 'وزارة الاتصالات وتكنولوجيا المعلومات',
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

test('currency formatting preserves cents charged by the payment gateway', () => {
  assert.equal(formatEGP(1234.56), '1,234.56 ج.م');
});

test('calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission', () => {
  const mockOrders: any[] = [
    {
      id: 'o1',
      orderNumber: 'CAP-001',
      storeIds: ['store-a'],
      orderStatus: 'delivered',
      subtotal: 100,
      total: 115,
      paymentMethod: 'cash',
      items: [
        { product: { id: 'p1', storeId: 'store-a', name: 'شاورما', price: 50 }, quantity: 2, extraPrice: 0 },
      ],
    },
    {
      id: 'o2',
      orderNumber: 'CAP-002',
      storeIds: ['store-a'],
      orderStatus: 'delivered',
      subtotal: 200,
      total: 215,
      paymentMethod: 'geidea',
      items: [
        { product: { id: 'p1', storeId: 'store-a', name: 'شاورما', price: 50 }, quantity: 4, extraPrice: 0 },
      ],
    },
    {
      id: 'o3',
      orderNumber: 'CAP-003',
      storeIds: ['store-a'],
      orderStatus: 'preparing', // Not delivered yet, should be excluded from final settled sales
      subtotal: 80,
      total: 95,
      paymentMethod: 'cash',
      items: [
        { product: { id: 'p2', storeId: 'store-a', name: 'عصير', price: 40 }, quantity: 2, extraPrice: 0 },
      ],
    },
  ];

  const summary = calculateMerchantAccountingSummary(mockOrders as Order[], 'store-a', 0.10);
  assert.equal(summary.grossSales, 300); // 100 + 200
  assert.equal(summary.platformCommission, 30); // 10% of 300
  assert.equal(summary.netPayout, 270);
  assert.equal(summary.ordersCount, 2);
  assert.equal(summary.byPaymentMethod.cash, 100);
  assert.equal(summary.byPaymentMethod.geidea, 200);
  assert.equal(summary.byPaymentMethod.instapay, 0);
});

test('generateMerchantJournalEntries creates balanced double-entry accounting records', () => {
  const mockOrders: any[] = [
    {
      id: 'o1',
      orderNumber: 'CAP-100',
      storeIds: ['store-xyz'],
      orderStatus: 'delivered',
      subtotal: 150,
      paymentMethod: 'instapay',
      items: [
        { product: { id: 'px', storeId: 'store-xyz', name: 'وجبة غداء', price: 150 }, quantity: 1 },
      ],
    },
  ];

  const entries = generateMerchantJournalEntries(mockOrders as Order[], 'store-xyz', 0.10);
  assert.equal(entries.length, 2);

  // 1st entry: Sales Recognition
  assert.equal(entries[1].orderNumber, 'CAP-100');
  assert.equal(entries[1].debitAccount, 'حـ/ التحويل المباشر (InstaPay)');
  assert.equal(entries[1].creditAccount, 'حـ/ إيرادات مبيعات المتجر');
  assert.equal(entries[1].amount, 150);

  // 2nd entry: Platform Fee
  assert.equal(entries[0].debitAccount, 'حـ/ مصروف عمولة تشغيل المنصة');
  assert.equal(entries[0].amount, 15);
});

test('calculateTopSellingProducts ranks products correctly by volume and share', () => {
  const mockOrders: any[] = [
    {
      id: 'o1',
      storeIds: ['store-1'],
      orderStatus: 'delivered',
      items: [
        { product: { id: 'p1', storeId: 'store-1', name: 'فول', category: 'فطور', price: 20 }, quantity: 5 },
        { product: { id: 'p2', storeId: 'store-1', name: 'فلافل', category: 'فطور', price: 10 }, quantity: 2 },
      ],
    },
    {
      id: 'o2',
      storeIds: ['store-1'],
      orderStatus: 'delivered',
      items: [
        { product: { id: 'p1', storeId: 'store-1', name: 'فول', category: 'فطور', price: 20 }, quantity: 5 },
      ],
    },
  ];

  const top = calculateTopSellingProducts(mockOrders as Order[], 'store-1');
  assert.equal(top.length, 2);
  assert.equal(top[0].name, 'فول');
  assert.equal(top[0].soldQuantity, 10);
  assert.equal(top[0].totalRevenue, 200);
  assert.equal(top[1].name, 'فلافل');
  assert.equal(top[1].soldQuantity, 2);
});

test('calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest', () => {
  const storeCoords = { latitude: 30.0131, longitude: 31.7346 };
  const couriers = [
    {
      id: 'c1',
      name: 'كابتن محمود',
      phone: '01011112222',
      rating: 4.9,
      avgDeliveryMinutes: 25,
      coordinates: { latitude: 30.0200, longitude: 31.7400 },
    },
    {
      id: 'c2',
      name: 'كابتن علي (الأسرع)',
      phone: '01033334444',
      rating: 4.95,
      avgDeliveryMinutes: 10,
      coordinates: { latitude: 30.0140, longitude: 31.7350 }, // Closest
    },
  ];

  const ranked = rankCouriersForStore(storeCoords, couriers);
  assert.equal(ranked.length, 2);
  // c2 is both closer and fastest
  assert.equal(ranked[0].id, 'c2');
  assert.equal(ranked[0].isFastest, true);
  assert.ok(ranked[0].distanceKm < ranked[1].distanceKm);
});
