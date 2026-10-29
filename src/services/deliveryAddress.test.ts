import test from 'node:test';
import assert from 'node:assert/strict';
import { placeAddress, uniqueAddress, usableDeliveryAddress } from './deliveryAddress.ts';

test('Arabic delivery addresses retain building and street without repeated districts', () => {
  assert.equal(placeAddress({ address: { building: 'مبنى ٥', road: 'شارع النخيل', neighbourhood: 'زهرة العاصمة', suburb: 'زهرة العاصمة', city: 'العاصمة الإدارية الجديدة', state: 'القاهرة' } }),
    'مبنى ٥، شارع النخيل، زهرة العاصمة، العاصمة الإدارية الجديدة، القاهرة');
  assert.equal(uniqueAddress(['شارع النخيل، القاهرة', 'القاهرة']), 'شارع النخيل، القاهرة');
  assert.equal(placeAddress({display_name:'شارع النخيل, القاهرة, القاهرة'}), 'شارع النخيل، القاهرة');
});

test('lookup failures and placeholder addresses cannot become confirmed delivery addresses', () => {
  for (const value of ['', 'abc', 'موقع محدد على الخريطة', 'تعذر البحث؛ حاول لاحقًا', 'قم بتحريك الخريطة لتحديد عنوانك']) assert.equal(usableDeliveryAddress(value), false);
  assert.equal(usableDeliveryAddress('شارع النخيل، مبنى ٥ بجوار المدرسة'), true);
});
