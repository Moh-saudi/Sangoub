import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOrder, nextKitchenUpdate, cairoDay, dailyOperations } from "./orderIntegration.ts";

test("Flutter summary records preserve totals and normalize Firestore timestamps", () => {
  const order = normalizeOrder({ id: "shared", itemsSummary: "وجبة ×2", total: 180, subtotal: 160, deliveryFee: 20,
    orderStatus: "ready", createdAt: { seconds: 1792540800 }, updatedAt: { toDate: () => new Date("2026-10-21T10:00:00Z") } });
  assert.equal(order.total, 180); assert.equal(order.subtotal, 160);
  assert.deepEqual(order.items, []); assert.equal(order.legacySummary, "وجبة ×2");
  assert.equal(order.updatedAt, "2026-10-21T10:00:00.000Z");
});
test("one kitchen cannot mark a multi-store order globally ready", () => {
  const order = normalizeOrder({ storeIds: ["a", "b"], orderStatus: "preparing", kitchenStatus: { a: "preparing", b: "received" } });
  const aReady = nextKitchenUpdate(order, "a", "ready");
  assert.equal(aReady.orderStatus, "preparing");
  const bPreparing = nextKitchenUpdate({ ...order, ...aReady }, "b", "preparing");
  const bReady = nextKitchenUpdate({ ...order, ...bPreparing }, "b", "ready");
  assert.equal(bReady.orderStatus, "ready");
  assert.throws(() => nextKitchenUpdate(order, "unassigned", "ready"));
  assert.throws(() => nextKitchenUpdate({ ...order, orderStatus: "delivered" }, "a", "ready"));
});
test("daily metrics use Cairo date and actual delivery time across midnight", () => {
  assert.equal(cairoDay("2026-10-20T22:30:00Z"), "2026-10-21");
  const old = normalizeOrder({ createdAt: "2026-10-19T09:00:00Z", deliveredAt: "2026-10-21T08:00:00Z", orderStatus: "delivered", total: 80 });
  const today = normalizeOrder({ createdAt: "2026-10-21T07:00:00Z", orderStatus: "received", total: 90 });
  const undated = normalizeOrder({ createdAt: "2026-10-21T07:00:00Z", orderStatus: "delivered", total: 300 });
  const metrics = dailyOperations([old, today, undated], "2026-10-21");
  assert.equal(metrics.created.length, 2); assert.equal(metrics.delivered.length, 1);
  assert.equal(metrics.deliveredValue, 80); assert.equal(metrics.missingDeliveryTime, 1);
});
