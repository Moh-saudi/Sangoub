export const LAUNCH_CONFIG = {
  // Only grocery service active for soft launch
  enabledCategories: ['mart'] as string[],
  // Payment methods enabled for soft launch
  enabledPaymentMethods: ['cash', 'instapay', 'vodafone_cash', 'card'] as string[],
  // Hide delivery time claims (20 min, 15-25 min) during soft launch
  showEta: false,
  etaText: 'توصيل حسب جدول المنطقة',
  // Specific launch area
  serviceAreaLabel: 'زهرة العاصمة',
  // Legal / brand entity line
  entityLine: 'سنجوب لتكنولوجيا التوصيل الذكي - إطلاق تجريبي زهرة العاصمة',
  // Hide wallet & coupon for soft launch
  showWallet: false,
  showCouponField: false,
  // Enforce zero merchant visibility
  hideMerchantNames: true,
  // Pricing & Delivery (mirrors server calculations)
  minOrder: 0,
  deliveryFee: 15,
  // Accounts for manual transfers
  instapayAccount: 'sangoub@instapay',
  vodafoneCashNumber: '01023456789',
} as const;
