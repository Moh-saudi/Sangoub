import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import operations from "../api/operations.ts";
import data from "../api/admin-data.ts";
import notifications from "../api/notifications.ts";
import orders from "../api/orders.ts";
import { adminServices } from "../server/firebaseAdmin.ts";
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw Error("Demo emulators required");
process.env.FIREBASE_PROJECT_ID = "demo-capital-talabat";
process.env.FIREBASE_DATABASE_ID = "(default)";
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
const app = initializeApp(
    { projectId: "demo-capital-talabat", apiKey: "demo-key" },
    "commerce-contracts",
  ),
  auth = getAuth(app),
  clientDb = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);
const service = adminServices();
async function call(handler: any, body: any, token: string) {
  let status = 200,
    result: any;
  await handler(
    { method: "POST", headers: { authorization: "Bearer " + token }, body },
    {
      setHeader() {},
      status(n: number) {
        status = n;
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
test("real emulator: scoped merchant catalog/preparation, settlement claims, notification registration and self profile rules", async () => {
  try {
    const account = async (name: string, role: string) => {
      const user = await service.auth.createUser({
        email: `${name}@example.com`,
        password: "TestPassword123!",
        emailVerified: true,
      });
      await service.db
        .doc("users/" + user.uid)
        .set({
          uid: user.uid,
          fullName: name,
          email: user.email,
          phone: "01012345678",
          ministry: "test",
          floorNumber: "1",
          roomNumber: "1",
          role: "employee",
          walletBalance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      if (role === "admin")
        await service.db.doc("admins/" + user.uid).set({ enabled: true });
      if (role === "restaurant")
        await service.db
          .doc("staff/" + user.uid)
          .set({ role, storeId: "contract-store", duty: "manager", name });
      const logged = await signInWithEmailAndPassword(
        auth,
        user.email!,
        "TestPassword123!",
      );
      return { uid: user.uid, token: await logged.user.getIdToken() };
    };
    const merchant = await account("contract-merchant", "restaurant"),
      admin = await account("contract-admin", "admin"),
      customer = await account("contract-customer", "employee");
    await service.db
      .doc("stores/contract-store")
      .set({ name: "Contract store", status: "open" });
    await service.db
      .doc("merchantContracts/contract-store")
      .set({ commissionRate: 10 });
    await service.db
      .doc("stores/other-store")
      .set({ name: "Other store", status: "open" });
    await service.db
      .doc("products/other-product")
      .set({
        id: "other-product",
        storeId: "other-store",
        name: "private product",
        price: 10,
      });
    assert.equal(
      (
        await call(
          operations,
          {
            action: "save-product",
            id: "contract-product",
            product: {
              name: "Product",
              description: "Test product",
              category: "فطور",
              price: 100,
            },
          },
          merchant.token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(operations, { action: "store-dashboard" }, merchant.token))
        .result.products.length,
      1,
    );
    assert.equal(
      (
        await call(
          operations,
          { action: "set-product-price", id: "other-product", price: 1 },
          merchant.token,
        )
      ).status,
      403,
    );
    const orderId = "contract-order";
    await service.db
      .doc("orders/" + orderId)
      .set({
        id: orderId,
        profileId: customer.uid,
        profileName: "Customer",
        paymentMethod: "cash",
        paymentStatus: "cash_on_delivery",
        orderStatus: "received",
        storeIds: ["contract-store"],
        kitchenStatus: { "contract-store": "received" },
        subtotal: 100,
        discount: 0,
        total: 115,
        items: [
          {
            id: "one",
            product: {
              id: "contract-product",
              storeId: "contract-store",
              price: 100,
            },
            quantity: 1,
            extraPrice: 0,
          },
        ],
        createdAt: new Date(),
      });
    assert.equal(
      (
        await call(
          operations,
          { action: "legacy-prepare", id: orderId, next: "preparing" },
          merchant.token,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          operations,
          { action: "legacy-prepare", id: orderId, next: "ready" },
          merchant.token,
        )
      ).status,
      200,
    );
    await service.db
      .doc("orders/" + orderId)
      .update({ orderStatus: "delivered", paymentStatus: "paid" });
    const preview = await call(
      data,
      {
        action: "settlement-preview",
        storeId: "contract-store",
        orderIds: [orderId],
      },
      admin.token,
    );
    assert.equal(preview.status, 200, JSON.stringify(preview.result));
    const save = {
      action: "settlement-save",
      id: "contract-settlement",
      storeId: "contract-store",
      orderIds: [orderId],
      quoteHash: preview.result.quoteHash,
      reference: "test-bank-ref",
    };
    const results = await Promise.all([
      call(data, save, admin.token),
      call(data, { ...save, id: "duplicate-settlement" }, admin.token),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (await service.db.collection("merchantSettlements").get()).size,
      1,
    );
    assert.equal(
      (
        await call(
          notifications,
          {
            action: "register-token",
            token: "test-device-token-1234567890",
            platform: "android",
          },
          customer.token,
        )
      ).status,
      200,
    );
    await signInWithEmailAndPassword(
      auth,
      "contract-customer@example.com",
      "TestPassword123!",
    );
    await updateDoc(doc(clientDb, "users", customer.uid), {
      fullName: "Renamed customer",
      updatedAt: serverTimestamp(),
    });
    assert.equal(
      (await service.db.doc("users/" + customer.uid).get()).data()?.fcmToken,
      "test-device-token-1234567890",
    );
    for (const patch of [
      { role: "admin" },
      { walletBalance: 999 },
      { fcmToken: "forged-device-token" },
      { unexpected: "schema pollution" },
      { uid: admin.uid },
      { fullName: "x".repeat(121) },
    ])
      await assert.rejects(() =>
        updateDoc(doc(clientDb, "users", customer.uid), {
          ...patch,
          updatedAt: serverTimestamp(),
        }),
      );
    assert.equal(
      (
        await call(
          orders,
          {
            action: "profile-address",
            makeDefault: true,
            address: {
              fullAddress: "Address",
              coordinates: { lat: 30, lng: 31 },
            },
          },
          customer.token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await service.db.doc("users/" + customer.uid).get()).data()?.coordinates
        .latitude,
      30,
    );
    assert.equal(
      (await call(notifications, { action: "list" }, customer.token)).status,
      403,
    );
    assert.equal(
      (await call(notifications, { action: "list" }, admin.token)).status,
      200,
    );
    // Repeated saves replace the current user's default, never add documents or touch another account.
    const usersBefore = (await service.db.collection('users').get()).size;
    const merchantBefore = (await service.db.doc('users/' + merchant.uid).get()).data();
    const fullAddress = 'شارع النخيل، مبنى ٥، زهرة العاصمة، ' + 'تفاصيل التوصيل '.repeat(10);
    // The API trims surrounding whitespace while preserving the full delivery address.
    const normalizedAddress = fullAddress.trim();
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await call(orders, { action: 'profile-address', makeDefault: true,
        address: { fullAddress, details: 'الدور الثالث، مكتب ٣', city: 'العاصمة الإدارية', coordinates: { latitude:30.01, longitude:31.7 } },
      }, customer.token)).status, 200);
    }
    const savedAddress = (await service.db.doc('users/' + customer.uid).get()).data();
    assert.equal(savedAddress?.defaultAddress.fullAddress, normalizedAddress);
    assert.equal(savedAddress?.defaultAddress.details, 'الدور الثالث، مكتب ٣');
    assert.deepEqual(savedAddress?.coordinates, { latitude:30.01, longitude:31.7 });
    assert.equal(savedAddress?.ministry.length, 120);
    assert.equal((await call(orders, {action:'profile-update',data:{ministry:savedAddress?.ministry,fullName:'عميل اختبار'}},customer.token)).status,200);
    assert.equal((await service.db.doc('users/'+customer.uid).get()).data()?.defaultAddress.fullAddress,normalizedAddress,'Unchanged address must not truncate the saved full address');
    assert.equal((await call(orders, {action:'profile-update',data:{ministry:'شارع جديد، مبنى ٦'}},customer.token)).status,200);
    assert.equal((await service.db.doc('users/'+customer.uid).get()).data()?.defaultAddress.fullAddress,'شارع جديد، مبنى ٦');
    assert.equal((await call(orders, {action:'profile-address',makeDefault:true,address:{fullAddress:'عنوان يدوي بدون نقطة مؤكدة'}},customer.token)).status,200);
    assert.equal((await service.db.doc('users/'+customer.uid).get()).data()?.coordinates,undefined);
    assert.equal((await service.db.collection('users').get()).size, usersBefore);
    assert.deepEqual((await service.db.doc('users/' + merchant.uid).get()).data(), merchantBefore);
    await service.db.doc("staff/" + merchant.uid).delete();
    assert.equal(
      (await call(operations, { action: "store-dashboard" }, merchant.token))
        .status,
      403,
    );
  } finally {
    await deleteApp(app);
  }
});
