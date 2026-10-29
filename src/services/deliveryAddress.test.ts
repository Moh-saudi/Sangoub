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

test('guest search sends no Firebase token and does not initialize authentication', async () => {
 const {searchOsm}=await import('./osmClient.ts');
 const result=await searchOsm({query:'شارع النخيل'},{getToken:async()=>{throw Error('must not ask guest to log in');},fetch:async(url,init)=>{
  assert.equal(url,'/api/osm/search');assert.equal(new Headers(init?.headers).has('Authorization'),false);
  return new Response(JSON.stringify({results:[{display_name:'شارع النخيل'}]}));
 }});
 assert.equal(result.results[0].display_name,'شارع النخيل');
});

test('guest address survives the sign-in transition without inheriting invalid or invented coordinates', async () => {
 const {readPendingDeliveryAddress}=await import('./deliveryAddress.ts');
 const storage=(value:any)=>({getItem:()=>JSON.stringify(value)});
 const selected={name:'شارع النخيل، زهرة العاصمة',details:'مبنى ٥',city:'العاصمة',latitude:30.025,longitude:31.725};
 assert.deepEqual(readPendingDeliveryAddress(storage(selected)),selected);
 assert.equal(readPendingDeliveryAddress(storage({name:'موقع محدد على الخريطة'})),null);
 assert.equal(readPendingDeliveryAddress(storage({...selected,latitude:200})),null);
 assert.equal(readPendingDeliveryAddress(storage({name:selected.name}))?.latitude,undefined);
});
