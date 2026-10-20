import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
let env: RulesTestEnvironment;
const projectId = "demo-capital-talabat";
const token = (email: string) => ({ email, email_verified: true });
const db = (uid: string) =>
  env.authenticatedContext(uid, token(uid + "@example.com")).firestore();
const timestamp = () => firebase.firestore.FieldValue.serverTimestamp();
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      db.doc("admins/admin").set({ enabled: true }),
      db
        .doc("staff/courier")
        .set({ role: "courier", name: "مندوب", phone: "01012345678" }),
      db
        .doc("staff/restaurant")
        .set({
          role: "restaurant",
          storeId: "s1",
          name: "مطعم",
          phone: "01012345678",
        }),
      db
        .doc("staff/other-restaurant")
        .set({
          role: "restaurant",
          storeId: "s2",
          name: "مطعم2",
          phone: "01012345678",
        }),
      db
        .doc("users/customer")
        .set({
          uid: "customer",
          email: "customer@example.com",
          fullName: "عميل",
          phone: "01012345678",
          ministry: "وزارة النقل",
          floorNumber: "5",
          roomNumber: "504",
          role: "employee",
          walletBalance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      db
        .doc("orders/o1")
        .set({
          profileId: "customer",
          storeIds: ["s1"],
          courierId: "courier",
          orderStatus: "with_courier",
          paymentMethod: "cash",
          paymentStatus: "cash_on_delivery",
          total: 80,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      db
        .doc("stores/s1")
        .set({
          id: "s1",
          name: "مطعم",
          status: "open",
          minOrder: 0,
          deliveryFee: 10,
        }),
    ]);
  });
});
test("anonymous and unverified sessions cannot read private profiles", async () => {
  await assertFails(
    env.unauthenticatedContext().firestore().doc("users/customer").get(),
  );
  await assertFails(
    env
      .authenticatedContext("customer", { email_verified: false })
      .firestore()
      .doc("users/customer")
      .get(),
  );
});
test("profile owners can read and update contacts but cannot change privilege or wallet", async () => {
  const ref = db("customer").doc("users/customer");
  await assertSucceeds(ref.get());
  await assertSucceeds(
    ref.update({ phone: "01112345678", updatedAt: timestamp() }),
  );
  await assertFails(ref.update({ role: "admin", updatedAt: timestamp() }));
  await assertFails(ref.update({ walletBalance: 999, updatedAt: timestamp() }));
  await assertFails(db("stranger").doc("users/customer").get());
});
test("admin email text does not grant privileges; admin docs cannot be self-created", async () => {
  await assertFails(
    env
      .authenticatedContext("attacker", token("el7lm25@gmail.com"))
      .firestore()
      .doc("users/customer")
      .get(),
  );
  await assertFails(
    db("customer").doc("admins/customer").set({ enabled: true }),
  );
  await assertSucceeds(db("admin").doc("users/customer").get());
});
test("customers only query their own orders", async () => {
  await assertSucceeds(
    db("customer")
      .collection("orders")
      .where("profileId", "==", "customer")
      .get(),
  );
  await assertFails(db("customer").collection("orders").get());
  await assertFails(db("stranger").doc("orders/o1").get());
});
test("clients cannot create orders or forge totals, including admins", async () => {
  await assertFails(
    db("customer")
      .doc("orders/forged")
      .set({ profileId: "customer", total: 0 }),
  );
  await assertFails(
    db("admin").doc("orders/o1").update({ total: 0, updatedAt: timestamp() }),
  );
});
test("restaurant reads and queries are restricted to its own store", async () => {
  await assertSucceeds(db("restaurant").doc("orders/o1").get());
  await assertSucceeds(
    db("restaurant")
      .collection("orders")
      .where("storeIds", "array-contains", "s1")
      .get(),
  );
  await assertFails(db("other-restaurant").doc("orders/o1").get());
});
test("courier may complete assigned cash order but cannot change owner", async () => {
  await assertSucceeds(
    db("courier")
      .doc("orders/o1")
      .update({
        orderStatus: "delivered",
        paymentStatus: "paid",
        updatedAt: timestamp(),
      }),
  );
  await assertFails(
    db("courier")
      .doc("orders/o1")
      .update({ profileId: "courier", updatedAt: timestamp() }),
  );
});
test("terminal orders cannot be reopened", async () => {
  await env.withSecurityRulesDisabled((c) =>
    c.firestore().doc("orders/o1").update({ orderStatus: "delivered" }),
  );
  await assertFails(
    db("admin")
      .doc("orders/o1")
      .update({ orderStatus: "preparing", updatedAt: timestamp() }),
  );
});
test("tracking can be shared only by assigned courier and read only by order participants", async () => {
  const record = {
    coordinates: { latitude: 30, longitude: 31 },
    active: true,
    updatedAt: timestamp(),
  };
  await assertSucceeds(db("courier").doc("tracking/o1").set(record));
  await assertFails(db("customer").doc("tracking/o1").set(record));
  await assertSucceeds(db("customer").doc("tracking/o1").get());
  await assertFails(db("stranger").doc("tracking/o1").get());
});
test("catalog management requires admin or own-store staff", async () => {
  const product = {
    id: "p1",
    storeId: "s1",
    storeName: "مطعم",
    name: "قهوة",
    description: "قهوة",
    price: 20,
    category: "مشروبات",
    imageType: "coffee",
    inStock: true,
    updatedAt: timestamp(),
  };
  await assertSucceeds(db("restaurant").doc("products/p1").set(product));
  await assertFails(
    db("customer")
      .doc("products/p2")
      .set({ ...product, id: "p2" }),
  );
  await assertFails(
    db("other-restaurant")
      .doc("products/p1")
      .update({ price: 1, updatedAt: timestamp() }),
  );
});
test("application personal information is admin-only and forged approval is rejected", async () => {
  const application = {
    ownerId: "customer",
    status: "pending",
    businessName: "مطعم",
    contactName: "أحمد",
    partnerType: "مطعم فود كورت",
    phone: "01012345678",
    email: "customer@example.com",
    locationInCapital: "C2",
    branchesCount: "1",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: timestamp(),
  };
  await assertSucceeds(
    db("customer").doc("partnerApplications/app1").set(application),
  );
  await assertFails(db("customer").doc("partnerApplications/app1").get());
  await assertFails(
    db("customer")
      .doc("partnerApplications/app1")
      .update({ status: "approved", updatedAt: timestamp() }),
  );
  await assertSucceeds(db("admin").doc("partnerApplications/app1").get());
});
