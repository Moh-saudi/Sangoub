import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { merchantAction } from "../server/merchantActions.ts";
import { settlementAction, settlementAmounts } from "../server/settlements.ts";
import {
  checkoutLines,
  consumeStorefrontCart,
  storefrontCartKey,
} from "../src/shop/storefrontCartBridge.ts";
class MemoryDb {
  data = new Map<string, any>();
  queue = Promise.resolve();
  doc(path: string): any {
    return {
      path,
      id: path.split("/").at(-1),
      parent: { id: path.split("/").at(-2) },
      get: async () => this.snapshot(path),
    };
  }
  snapshot(path: string) {
    return {
      ref: this.doc(path),
      id: path.split("/").at(-1),
      exists: this.data.has(path),
      data: () => this.data.get(path),
    };
  }
  collection(path: string): any {
    const filters: any[] = [];
    let max = Infinity;
    const q: any = {
      doc: (id = randomUUID()) => this.doc(path + "/" + id),
      where: (key: string, op: string, value: any) => {
        filters.push([key, op, value]);
        return q;
      },
      orderBy: () => q,
      limit: (n: number) => {
        max = n;
        return q;
      },
      get: async () => {
        const docs = [...this.data.keys()]
          .filter(
            (k) =>
              k.startsWith(path + "/") &&
              k.split("/").length === path.split("/").length + 1,
          )
          .map((k) => this.snapshot(k))
          .filter((d) =>
            filters.every(([k, op, v]) =>
              op === "array-contains"
                ? d.data()[k]?.includes(v)
                : d.data()[k] === v,
            ),
          )
          .slice(0, max);
        return { docs, size: docs.length };
      },
    };
    return q;
  }
  async runTransaction(fn: any) {
    let finish!: () => void;
    const previous = this.queue;
    this.queue = new Promise((r) => (finish = r));
    await previous;
    try {
      let written = false;
      const writes: any[] = [];
      const tx: any = {
        get: async (ref: any) => {
          assert.equal(written, false, "All reads precede writes");
          return this.snapshot(ref.path);
        },
        create: (ref: any, data: any) => {
          written = true;
          assert.equal(this.data.has(ref.path), false);
          writes.push([ref, data, false]);
        },
        set: (ref: any, data: any, options: any) => {
          written = true;
          writes.push([ref, data, Boolean(options?.merge)]);
        },
        update: (ref: any, data: any) => {
          written = true;
          assert.ok(this.data.has(ref.path));
          writes.push([ref, data, true]);
        },
      };
      const result = await fn(tx);
      for (const [ref, data, merge] of writes)
        this.data.set(ref.path, {
          ...(merge ? this.data.get(ref.path) : {}),
          ...data,
        });
      return result;
    } finally {
      finish();
    }
  }
}
const actor = {
  uid: "merchant",
  auth_time: 100,
  email: "merchant@example.com",
};
function setup() {
  const db = new MemoryDb();
  db.data.set("stores/a", { name: "Store A", status: "open" });
  db.data.set("merchantContracts/a", { commissionRate: 10 });
  db.data.set("stores/b", { name: "Store B", status: "open" });
  db.data.set("staff/merchant", {
    role: "restaurant",
    storeId: "a",
    duty: "manager",
  });
  db.data.set("products/a-item", {
    id: "a-item",
    storeId: "a",
    price: 10,
    inStock: true,
  });
  db.data.set("products/b-item", {
    id: "b-item",
    storeId: "b",
    price: 20,
    inStock: true,
  });
  return {
    db,
    actor,
    role: "restaurant",
    verified: true,
    staff: { storeId: "a" },
  } as any;
}
const order = (id = "o1", patch: any = {}) =>
  ({
    id,
    orderStatus: "delivered",
    paymentStatus: "paid",
    storeIds: ["a"],
    subtotal: 100,
    discount: 10,
    items: [
      {
        id: "item",
        product: { id: "a-item", storeId: "a", price: 100 },
        extraPrice: 0,
        quantity: 1,
      },
    ],
    ...patch,
  }) as any;
test("merchant operations enforce store and manager scope, recheck revocation, persist writes and audit", async () => {
  const c = setup();
  const list: any = await merchantAction({ action: "store-dashboard" }, c);
  assert.equal(list.products.length, 1);
  assert.equal(list.products[0].id, "a-item");
  await assert.rejects(
    () =>
      merchantAction(
        { action: "set-product-price", id: "b-item", price: 1 },
        c,
      ),
    /متجر/,
  );
  await merchantAction(
    { action: "set-product-price", id: "a-item", price: 12 },
    c,
  );
  assert.equal(c.db.data.get("products/a-item").price, 12);
  assert.ok([...c.db.data.keys()].some((k) => k.startsWith("auditLogs/")));
  c.db.data.set("staff/merchant", {
    role: "restaurant",
    storeId: "a",
    duty: "preparer",
  });
  await assert.rejects(
    () =>
      merchantAction(
        { action: "set-product-stock", id: "a-item", inStock: false },
        c,
      ),
    /مدير/,
  );
  c.db.data.set("accountAccess/merchant", { disabled: true });
  await assert.rejects(
    () =>
      merchantAction(
        { action: "set-product-price", id: "a-item", price: 5 },
        c,
      ),
    /صلاحية/,
  );
});
test("merchant preparation requires payment, correct transitions and all stores ready", async () => {
  const c = setup();
  c.db.data.set(
    "orders/o",
    order("o", {
      orderStatus: "received",
      paymentStatus: "pending",
      paymentMethod: "geidea",
      kitchenStatus: { a: "received" },
    }),
  );
  await assert.rejects(
    () =>
      merchantAction(
        { action: "legacy-prepare", id: "o", next: "preparing" },
        c,
      ),
    /غير متاح/,
  );
  c.db.data.set(
    "orders/o",
    order("o", {
      orderStatus: "received",
      paymentStatus: "cash_on_delivery",
      paymentMethod: "cash",
      storeIds: ["a", "b"],
      kitchenStatus: { a: "received", b: "preparing" },
    }),
  );
  await merchantAction(
    { action: "legacy-prepare", id: "o", next: "preparing" },
    c,
  );
  await merchantAction({ action: "legacy-prepare", id: "o", next: "ready" }, c);
  assert.equal(c.db.data.get("orders/o").orderStatus, "preparing");
  assert.equal(c.db.data.get("orders/o").kitchenStatus.b, "preparing");
});
test("settlement money excludes delivery and included tax from commission, with no double tax", () => {
  const result = settlementAmounts(
    order("o", {
      storeSnapshots: [
        {
          id: "a",
          subtotal: 114,
          discount: 0,
          includedTax: 14,
          additionalTax: 0,
        },
      ],
      total: 150,
      deliveryFee: 36,
    }),
    "a",
    10,
  );
  assert.equal(result.gross, 114);
  assert.equal(result.basis, 100);
  assert.equal(result.commission, 10);
  assert.equal(result.net, 104);
  assert.throws(
    () => settlementAmounts(order("o", { paymentStatus: "pending" }), "a", 10),
    /المدفوعة/,
  );
});
test("settlements require a contract and review hash, persist claims atomically and prevent duplicate payout", async () => {
  const c = setup();
  c.actor = { uid: "admin", auth_time: 100, email: "admin@example.com" };
  c.db.data.set("admins/admin", { enabled: true });
  c.db.data.set("orders/o1", order());
  const input = { storeId: "a", orderIds: ["o1"] };
  const preview = await settlementAction(
    { ...input, action: "settlement-preview" },
    c,
  );
  assert.equal(preview.quote.net, 81);
  await assert.rejects(
    () =>
      settlementAction(
        {
          ...input,
          action: "settlement-save",
          id: "s1",
          reference: "bank-ref",
          quoteHash: "stale",
        },
        c,
      ),
    /تغيرت/,
  );
  assert.equal(c.db.data.has("merchantSettlements/s1"), false);
  const saved = await settlementAction(
    {
      ...input,
      action: "settlement-save",
      id: "s1",
      reference: "bank-ref",
      quoteHash: preview.quoteHash,
    },
    c,
  );
  assert.equal(saved.record.net, 81);
  const repeat = await settlementAction(
    {
      ...input,
      action: "settlement-save",
      id: "s1",
      reference: "bank-ref",
      quoteHash: preview.quoteHash,
    },
    c,
  );
  assert.equal(repeat.record.id, "s1");
  await assert.rejects(
    () => settlementAction({ ...input, action: "settlement-preview" }, c),
    /بالفعل/,
  );
  c.db.data.set("orders/o2", order("o2"));
  c.db.data.delete("merchantContracts/a");
  await assert.rejects(
    () =>
      settlementAction(
        { action: "settlement-preview", storeId: "a", orderIds: ["o2"] },
        c,
      ),
    /التعاقد/,
  );
});
test("checkout bridge retains identity/options, rejects mixed merchants, consumes only acknowledged units", () => {
  const item: any = {
    id: "line",
    product: { id: "a-item", storeId: "a", price: 999 },
    quantity: 2,
    selectedOptions: { size: "large" },
    notes: "note",
  };
  const lines = checkoutLines([item]);
  assert.equal("price" in lines[0], false);
  assert.equal(lines[0].quantity, 2);
  assert.throws(
    () =>
      checkoutLines([
        item,
        { ...item, id: "other", product: { id: "b-item", storeId: "b" } },
      ]),
    /متجر واحد/,
  );
  const state = new Map([
    [
      storefrontCartKey,
      JSON.stringify([
        { ...item, quantity: 3 },
        { ...item, id: "added", quantity: 1 },
      ]),
    ],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => state.get(key),
      setItem: (key: string, value: string) => state.set(key, value),
    },
  });
  consumeStorefrontCart(lines);
  const remaining = JSON.parse(state.get(storefrontCartKey)!);
  assert.equal(remaining[0].quantity, 1);
  assert.equal(remaining[1].id, "added");
  delete (globalThis as any).localStorage;
});
