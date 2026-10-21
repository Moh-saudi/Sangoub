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
import imagesHandler from "../api/catalog-images.ts";
import deliveryHandler from "../api/order-delivery.ts";
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
async function invoke(body: any, endpoint = handler, bearer = token) {
  let status = 200;
  let result: any;
  await endpoint(
    { method: "POST", headers: { authorization: "Bearer " + bearer }, body },
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

test("catalog signing rejects a real authenticated customer", async () => {
  const response = await invoke({ action: "upload", collection: "stores", id: "api-store", contentType: "image/png", size: 100 }, imagesHandler);
  assert.equal(response.status, 403);
});

test("catalog signing grants a short-lived size-bound URL only to an admin", async () => {
  const names = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_URL"];
  const previous = names.map((name) => process.env[name]);
  // Synthetic signing credentials; this test never connects to R2.
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_PUBLIC_URL = "https://images.example.com";
  await services.db.doc("admins/" + uid).set({ enabled: true });
  try {
    const response = await invoke({ action: "upload", collection: "products", id: "api-product", contentType: "image/png", size: 100 }, imagesHandler);
    assert.equal(response.status, 200);
    const url = new URL(response.result.uploadUrl);
    assert.equal(url.hostname, "14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com");
    assert.equal(url.searchParams.get("X-Amz-Expires"), "120");
    assert.match(url.searchParams.get("X-Amz-SignedHeaders")!, /content-length/);
    assert.match(url.searchParams.get("X-Amz-SignedHeaders")!, /content-type/);
    assert.match(response.result.publicUrl, /^https:\/\/images.example.com\/catalog\/products\/api-product\//);
    const invalid = await invoke({ action: "delete", key: "outside/catalog.png" }, imagesHandler);
    assert.equal(invalid.status, 400);
  } finally {
    await services.db.doc("admins/" + uid).delete();
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test("OTP is private to the customer and delivery is verified on the server", async () => {
  await services.db.doc("orderLimits/" + uid).delete();
  const created = await invoke(payload());
  assert.equal(created.status, 200);
  const orderId = created.result.order.id;
  const main = await services.db.doc("orders/" + orderId).get();
  assert.equal(main.data()!.otpCode, undefined);
  assert.equal(main.data()!.itemsSummary.length > 0, true);
  const code = await invoke({ action: "code", orderId }, deliveryHandler);
  assert.equal(code.status, 200); assert.match(code.result.otpCode, /^\d{4}$/);
  const courier = await services.auth.createUser({ email: `courier-${Date.now()}@example.com`, emailVerified: true, password: "EmulatorPassword123!" });
  const login = await signInWithEmailAndPassword(auth, courier.email!, "EmulatorPassword123!");
  const courierToken = await login.user.getIdToken();
  await services.db.doc("staff/" + courier.uid).set({ role: "courier" });
  await services.db.doc("orders/" + orderId).update({ orderStatus: "with_courier", courierId: courier.uid });
  const forbidden = await invoke({ action: "code", orderId }, deliveryHandler, courierToken);
  assert.equal(forbidden.status, 403);
  const payloadDelivery = { action: "deliver", orderId, otpCode: code.result.otpCode, collectedAmount: created.result.order.total };
  assert.equal((await invoke(payloadDelivery, deliveryHandler)).status, 403);
  const wrong = code.result.otpCode === "0000" ? "1111" : "0000";
  assert.equal((await invoke({ ...payloadDelivery, otpCode: wrong }, deliveryHandler, courierToken)).status, 400);
  assert.equal((await services.db.doc("orderSecrets/" + orderId).get()).data()!.attempts, 1);
  for (let attempt = 0; attempt < 4; attempt++)
    assert.equal((await invoke({ ...payloadDelivery, otpCode: wrong }, deliveryHandler, courierToken)).status, 400);
  assert.equal((await invoke(payloadDelivery, deliveryHandler, courierToken)).status, 429);
  await services.db.doc("orderSecrets/" + orderId).update({ lockedUntil: new Date(0) });
  assert.equal((await invoke({ ...payloadDelivery, collectedAmount: 0 }, deliveryHandler, courierToken)).status, 400);
  assert.equal((await invoke(payloadDelivery, deliveryHandler, courierToken)).status, 200);
  assert.equal((await invoke(payloadDelivery, deliveryHandler, courierToken)).status, 200);
  const delivered = (await services.db.doc("orders/" + orderId).get()).data()!;
  assert.equal(delivered.orderStatus, "delivered"); assert.equal(delivered.deliveredAt.constructor.name, "Timestamp");
  assert.equal((await services.db.doc("orderSecrets/" + orderId).get()).exists, false);
});
