import test from "node:test";
import assert from "node:assert/strict";
import type { Product, Store } from "../types";
import { availableOffers, hasProductOffer, productDiscountPercent } from "./productOffers";

const product = { id: "offer", name: "وجبة", storeId: "open", price: 75, originalPrice: 100, inStock: true } as Product;
const stores = [{ id: "open", status: "open" }, { id: "closed", status: "closed" }] as Store[];

test("offers exclude invalid discounts, archived stock, and closed or missing stores", () => {
  const products = [product, ...[
    { id: "same", price: 100 }, { id: "higher", price: 120 }, { id: "no-original", originalPrice: undefined },
    { id: "invalid", originalPrice: NaN }, { id: "negative", price: -1 }, { id: "invalid-price", price: Infinity },
    { id: "archived", archived: true }, { id: "unavailable", inStock: false },
    { id: "closed", storeId: "closed" }, { id: "missing", storeId: "missing" },
  ].map(change => ({ ...product, ...change }))];
  assert.deepEqual(availableOffers(products, stores).map(item => item.id), ["offer"]);
  assert.equal(productDiscountPercent(product), 25);
  assert.equal(productDiscountPercent({ ...product, originalPrice: 0 }), 0);
  assert.equal(hasProductOffer({ ...product, price: 0 }), true);
});

test("price and store availability changes immediately update offer eligibility", () => {
  assert.equal(availableOffers([product], stores).length, 1);
  assert.equal(availableOffers([{ ...product, originalPrice: product.price }], stores).length, 0);
  assert.equal(availableOffers([product], [{ ...stores[0], status: "busy" }]).length, 0);
  assert.equal(availableOffers([{ ...product, price: 50 }], stores)[0].price, 50);
});
