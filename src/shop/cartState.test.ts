import test from "node:test";
import assert from "node:assert/strict";
import { remainingCart, type CartLine } from "./cartState";
const line: CartLine = {
  id: "line-a",
  productId: "p",
  quantity: 2,
  selectedOptions: {},
  notes: "",
};
test("checkout acknowledgment cannot erase quantities or new lines added during the request", () => {
  const added = { ...line, id: "line-b", quantity: 1 };
  assert.deepEqual(remainingCart([{ ...line, quantity: 5 }, added], [line]), [
    { ...line, quantity: 3 },
    added,
  ]);
  assert.deepEqual(remainingCart([added], [line]), [added]);
  assert.deepEqual(remainingCart([line], [line]), []);
});
