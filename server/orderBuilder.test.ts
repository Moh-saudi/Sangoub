import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrder } from "./orderBuilder.ts";
import type { Product, Store, Coupon } from "../src/types/index.ts";
const product = {
  id: "p1",
  storeId: "s1",
  storeName: "متجر",
  name: "قهوة",
  description: "قهوة",
  price: 30,
  category: "مشروبات",
  imageType: "coffee",
  inStock: true,
  optionGroups: [
    {
      id: "size",
      title: "الحجم",
      required: true,
      options: [{ name: "كبير", price: 5 }],
    },
  ],
} as Product;
const store = {
  id: "s1",
  name: "متجر",
  status: "open",
  deliveryFee: 10,
  minOrder: 0,
} as Store;
const payload = () => ({
  id: "ord-00000000-0000-4000-8000-000000000000",
  items: [
    {
      product: { id: "p1", price: 0 },
      quantity: 2,
      selectedOptions: { الحجم: "كبير" },
      extraPrice: 0,
    },
  ],
  profileName: "أحمد",
  phone: "01012345678",
  ministry: "وزارة النقل",
  floorNumber: "5",
  roomNumber: "504",
  paymentMethod: "cash",
  tip: 5,
  total: 0,
});
const build = (input: any, p = product, s = store, c?: Coupon) =>
  buildOrder(input, "real-uid", new Map([[p.id, p]]), new Map([[s.id, s]]), c);
test("server ignores submitted prices, totals and identity", () => {
  const order = build({ ...payload(), profileId: "someone-else" });
  assert.equal(order.total, 85);
  assert.equal(order.subtotal, 70);
  assert.equal(order.items[0].extraPrice, 5);
  assert.equal(order.profileId, "real-uid");
  assert.equal(order.paymentStatus, "cash_on_delivery");
});
test("server rejects forged options and missing required options", () => {
  for (const options of [
    { الحجم: "مزيف" },
    {},
    { الحجم: "كبير", unknown: "x" },
  ])
    assert.throws(() =>
      build({
        ...payload(),
        items: [{ ...payload().items[0], selectedOptions: options }],
      }),
    );
});
test("server rejects unavailable stock, closed stores and minimum order violations", () => {
  assert.throws(() => build(payload(), { ...product, inStock: false }));
  assert.throws(() => build(payload(), { ...product, inStock: true, archived: true }));
  assert.throws(() =>
    build(payload(), product, { ...store, status: "closed" }),
  );
  assert.throws(() => build(payload(), product, { ...store, minOrder: 200 }));
});
test("server rejects invalid quantities, tips, phone and coordinates", () => {
  for (const quantity of [0, -1, 1.5, 51])
    assert.throws(() =>
      build({ ...payload(), items: [{ ...payload().items[0], quantity }] }),
    );
  for (const tip of [-1, NaN, 1001])
    assert.throws(() => build({ ...payload(), tip }));
  assert.throws(() => build({ ...payload(), phone: "123" }));
  assert.throws(() =>
    build({ ...payload(), coordinates: { latitude: 91, longitude: 31 } }),
  );
});
test("server only accepts configured cash payment and valid coupons", () => {
  assert.throws(() => build({ ...payload(), paymentMethod: "unsupported" }));
  assert.throws(() => build({ ...payload(), couponCode: "FAKE" }));
  const order = build({ ...payload(), couponCode: "TEN" }, product, store, {
    code: "TEN",
    minOrder: 50,
    value: 10,
    discountType: "fixed",
  } as Coupon);
  assert.equal(order.total, 75);
});

test("electronic payment selection does not mark an order paid", () => {
  const order = build({ ...payload(), paymentMethod: "geidea" });
  assert.equal(order.paymentMethod, "geidea");
  assert.equal(order.paymentStatus, "pending");
});
