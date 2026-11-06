export const LAUNCH_CONFIG = {
  // All delivery services active across restaurants, mart, groceries, cafe, pharmacy, breakfast, etc.
  enabledCategories: [] as string[],
  // Payment methods enabled
  enabledPaymentMethods: ['cash'] as string[],
  // Show delivery time claims (20-30 min)
  showEta: true,
  etaText: '20-30 دقيقة',
  // Service area coverage
  serviceAreaLabel: 'العاصمة وكافة المناطق',
  // Legal / brand entity line
  entityLine: 'سنجوب لتكنولوجيا التوصيل والطلب الذكي 🐿️',
  // Enable wallet & coupon
  showWallet: true,
  showCouponField: true,
  // Show real partner stores & merchants
  hideMerchantNames: false,
  // Pricing & Delivery (mirrors server calculations)
  minOrder: 0,
  deliveryFee: 15,
} as const;
