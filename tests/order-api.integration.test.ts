import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getApps, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { adminServices } from "../server/firebaseAdmin.ts";
import handler from "../api/orders.ts";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_PROJECT_ID = "demo-capital-talabat";
process.env.FIREBASE_DATABASE_ID = "(default)";
const app = initializeApp(
  { apiKey: "demo-key", projectId: "demo-capital-talabat" },
  "order-api-integration",
);
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
let token: string;
let uid: string;
let services: ReturnType<typeof adminServices>;
const payload = () => ({
  id: "ord-" + randomUUID(),
  profileName: "عميل اختبار",
  phone: "01012345678",
  ministry: "وزارة النقل",
  floorNumber: "5",
  roomNumber: "504",
  paymentMethod: "cash",
  tip: 0,
  items: [
    {
      product: { id: "api-product", price: 0 },
      quantity: 2,
      selectedOptions: {},
    },
  ],
  total: 0,
});
async function invoke(body: any) {
  let status = 200;
  let result: any;
  await handler(
    { method: "POST", headers: { authorization: "Bearer " + token }, body },
    {
      setHeader() {},
      status(code: number) {
        status = code;
        return this;
      },
      json(value: any) {
        result = value;
        return this;
      },
    },
  );
  return { status, result };
}
before(async () => {
  services = adminServices();
  const account = await services.auth.createUser({
    email: `orders-${Date.now()}@example.com`,
    emailVerified: true,
    password: "EmulatorPassword123!",
  });
  uid = account.uid;
  const user = await signInWithEmailAndPassword(
    auth,
    account.email!,
    "EmulatorPassword123!",
  );
  token = await user.user.getIdToken();
  await Promise.all([
    services.db.doc("users/" + uid).set({ uid, fullName: "عميل اختبار" }),
    services.db
      .doc("stores/api-store")
      .set({
        id: "api-store",
        name: "مطعم اختبار",
        status: "open",
        minOrder: 0,
        deliveryFee: 10,
      }),
    services.db
      .doc("products/api-product")
      .set({
        id: "api-product",
        storeId: "api-store",
        storeName: "مطعم اختبار",
        name: "وجبة",
        description: "اختبار",
        price: 35,
        inStock: true,
        category: "وجبات خفيفة",
        imageType: "croissant",
      }),
  ]);
});
after(async () => {
  await deleteApp(app);
  for (const app of getApps()) await deleteAdminApp(app);
});
test("authenticated order API stores complete items and authoritative prices in Firestore", async () => {
  const input = payload();
  const response = await invoke(input);
  assert.equal(response.status, 200, JSON.stringify(response.result));
  assert.equal(response.result.order.total, 80);
  assert.equal(response.result.order.profileId, uid);
  const snapshot = await services.db
    .doc("orders/" + response.result.order.id)
    .get();
  assert.equal(snapshot.data()!.items.length, 1);
  assert.equal(snapshot.data()!.items[0].product.price, 35);
  assert.equal(snapshot.data()!.paymentStatus, "cash_on_delivery");
  assert.equal(snapshot.data()!.createdAt.constructor.name, "Timestamp");
});
test("concurrent retry with the same order id creates one order and consumes one quota slot", async () => {
  const before = (await services.db.doc("orderLimits/" + uid).get()).data()!
    .count;
  const input = payload();
  const [first, second] = await Promise.all([invoke(input), invoke(input)]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.result.order.id, second.result.order.id);
  assert.equal(
    (await services.db.doc("orderLimits/" + uid).get()).data()!.count,
    before + 1,
  );
});
test("API rejects unavailable products without creating an order", async () => {
  await services.db.doc("products/api-product").update({ inStock: false });
  const input = payload();
  const response = await invoke(input);
  assert.equal(response.status, 400);
  assert.equal(
    (await services.db.doc("orders/" + uid + "_" + input.id).get()).exists,
    false,
  );
  await services.db.doc("products/api-product").update({ inStock: true });
});
test("daily quota stops additional orders with HTTP 429", async () => {
  await services.db
    .doc("orderLimits/" + uid)
    .set({ startedAt: Date.now(), count: 30 });
  assert.equal((await invoke(payload())).status, 429);
});
