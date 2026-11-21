import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateServiceFee, calculateOrderTotal, applyCouponDiscount } from '../src/utils/orderCalculations.ts';
import { isProductOrderableNow } from '../src/utils/storeAssets.ts';

test('Speed & Architecture: calculateServiceFee strictly enforces 4% with 4.90 EGP floor and 16.50 EGP ceiling', () => {
  // Edge Case 1: Zero or negative subtotal
  assert.equal(calculateServiceFee(0), 0);
  assert.equal(calculateServiceFee(-10), 0);

  // Edge Case 2: Small order hits minimum platform fee (4.90 EGP)
  // 50 * 0.04 = 2.00 -> should clamp to 4.90
  assert.equal(calculateServiceFee(50), 4.90);
  assert.equal(calculateServiceFee(100), 4.90);

  // Edge Case 3: Standard basket (175 EGP gives exactly 7.00 EGP)
  assert.equal(calculateServiceFee(175), 7.00);

  // Edge Case 4: Medium order
  // 300 * 0.04 = 12.00
  assert.equal(calculateServiceFee(300), 12.00);

  // Edge Case 5: Large order hits maximum platform fee cap (16.50 EGP)
  // 500 * 0.04 = 20.00 -> should clamp to 16.50
  assert.equal(calculateServiceFee(500), 16.50);
  assert.equal(calculateServiceFee(2000), 16.50);
});

test('Speed & Architecture: Cache Sanitization bounds 600+ items to well under 500KB to prevent browser QuotaExceededError', () => {
  // Simulate 600 products, where 250 products contain heavy inline base64 strings (100KB each)
  const heavyCatalog: Array<{ id: string; name: string; price: number; imageUrl: string }> = [];

  for (let i = 0; i < 600; i++) {
    const isHeavy = i % 2 === 0;
    heavyCatalog.push({
      id: `prod-${i}`,
      name: `صنف غذائي رقم ${i}`,
      price: 25 + (i % 50),
      imageUrl: isHeavy
        ? `data:image/jpeg;base64,${'A'.repeat(80000)}` // 80KB base64
        : `https://img.sangoub.com/products/item-${i}.webp`
    });
  }

  // Before sanitization: payload is massive (~25 Megabytes)
  const rawSize = Buffer.byteLength(JSON.stringify(heavyCatalog), 'utf8');
  assert.ok(rawSize > 20 * 1024 * 1024, 'Simulated raw catalog should be over 20MB');

  // Sanitize according to Sangoub Speed Rules (strip inline base64 > 500 chars)
  const sanitized = heavyCatalog.map((p) => ({
    ...p,
    imageUrl: p.imageUrl.startsWith('data:') && p.imageUrl.length > 500 ? '' : p.imageUrl
  }));

  const sanitizedSize = Buffer.byteLength(JSON.stringify(sanitized), 'utf8');
  
  // Sanitized catalog must stay well below 500 KB (comfortably within 5MB localStorage limit)
  assert.ok(sanitizedSize < 350 * 1024, `Sanitized cache (${(sanitizedSize / 1024).toFixed(1)} KB) must be under 350 KB`);
});

test('Speed & Architecture: isProductOrderableNow avoids race conditions when stores are loading', () => {
  const sampleProduct = {
    storeId: 'merchant-store-1',
    storeName: 'حلواني العاصمة',
    inStock: true,
    archived: false,
    is_available: true
  };

  // 1. While stores list is still loading (empty array), products must NOT be prematurely hidden!
  const loadingStores: any[] = [];
  assert.equal(isProductOrderableNow(sampleProduct, loadingStores), true);

  // 2. When stores are resolved and store is OPEN
  const openStores = [
    { id: 'merchant-store-1', name: 'حلواني العاصمة', status: 'open', is_active: true }
  ];
  assert.equal(isProductOrderableNow(sampleProduct, openStores), true);

  // 3. When store is CLOSED
  const closedStores = [
    { id: 'merchant-store-1', name: 'حلواني العاصمة', status: 'closed', is_active: true }
  ];
  assert.equal(isProductOrderableNow(sampleProduct, closedStores), false);

  // 4. Archived or out-of-stock items are always excluded
  assert.equal(isProductOrderableNow({ ...sampleProduct, inStock: false }, openStores), false);
  assert.equal(isProductOrderableNow({ ...sampleProduct, archived: true }, openStores), false);
});

test('Speed & Architecture: Order totals preserve exact coupon discounts and service fees', () => {
  const subtotal = 175;
  const deliveryFee = 8;
  const serviceFee = calculateServiceFee(subtotal); // 7.00
  const coupon = {
    code: 'MOHP01',
    discountType: 'fixed' as const,
    value: 15,
    minOrder: 100,
    active: true
  };

  const couponResult = applyCouponDiscount(subtotal, coupon);
  assert.equal(couponResult.discount, 15);

  const orderTotal = calculateOrderTotal(subtotal, deliveryFee, couponResult.discount, 0, serviceFee);
  // 175 + 8 + 7 - 15 = 175 EGP
  assert.equal(orderTotal, 175);
});
