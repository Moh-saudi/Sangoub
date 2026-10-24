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
      db.doc("staff/restaurant").set({
        role: "restaurant",
        storeId: "s1",
        name: "مطعم",
        phone: "01012345678",
      }),
      db.doc("staff/other-restaurant").set({
        role: "restaurant",
        storeId: "s2",
        name: "مطعم2",
        phone: "01012345678",
      }),
      db.doc("users/customer").set({
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
      db.doc("orders/o1").set({
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
      db.doc("stores/s1").set({
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
test("courier cannot bypass server OTP completion or change owner", async () => {
  await assertFails(
    db("courier").doc("orders/o1").update({
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

test("new verified accounts can create their own profile but cannot inject extra fields", async () => {
  const profile = {
    uid: "new-customer",
    email: "new-customer@example.com",
    fullName: "",
    phone: "",
    ministry: "",
    floorNumber: "",
    roomNumber: "",
    role: "employee",
    walletBalance: 0,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
  await assertSucceeds(
    db("new-customer").doc("users/new-customer").set(profile),
  );
  await assertFails(
    db("new-customer")
      .doc("users/new-customer")
      .update({ isAdmin: true, updatedAt: timestamp() }),
  );
});
test("customers can only cancel their own received order", async () => {
  await env.withSecurityRulesDisabled((c) =>
    c.firestore().doc("orders/o1").update({ orderStatus: "received" }),
  );
  await assertFails(
    db("stranger")
      .doc("orders/o1")
      .update({ orderStatus: "cancelled", updatedAt: timestamp() }),
  );
  await assertSucceeds(
    db("customer")
      .doc("orders/o1")
      .update({ orderStatus: "cancelled", updatedAt: timestamp() }),
  );
});
test("restaurant can mark readiness but cannot assign a courier or complete delivery", async () => {
  await env.withSecurityRulesDisabled((c) =>
    c.firestore().doc("orders/o1").update({ orderStatus: "preparing" }),
  );
  await assertSucceeds(
    db("restaurant")
      .doc("orders/o1")
      .update({ orderStatus: "ready", kitchenStatus: { s1: "ready" }, readyAt: timestamp(), updatedAt: timestamp() }),
  );
  await assertFails(
    db("restaurant")
      .doc("orders/o1")
      .update({ orderStatus: "with_courier", updatedAt: timestamp() }),
  );
  await assertFails(
    db("restaurant")
      .doc("orders/o1")
      .update({ courierId: "restaurant", updatedAt: timestamp() }),
  );
});
test("admin assignments must use the audited server API", async () => {
  await env.withSecurityRulesDisabled((c) =>
    c
      .firestore()
      .doc("orders/o1")
      .update({ orderStatus: "ready", courierId: "" }),
  );
  await assertFails(
    db("admin")
      .doc("orders/o1")
      .update({
        courierId: "customer",
        orderStatus: "with_courier",
        updatedAt: timestamp(),
      }),
  );
  await assertFails(
    db("admin")
      .doc("orders/o1")
      .update({
        courierId: "courier",
        orderStatus: "with_courier",
        updatedAt: timestamp(),
      }),
  );
});
test("revoking courier staff membership removes access to assigned orders", async () => {
  await env.withSecurityRulesDisabled((c) =>
    c.firestore().doc("staff/courier").delete(),
  );
  await assertFails(db("courier").doc("orders/o1").get());
  await assertFails(
    db("courier")
      .doc("orders/o1")
      .update({ orderStatus: "delivered", updatedAt: timestamp() }),
  );
});
test("courier can stop tracking after delivery but cannot restart it", async () => {
  const record = {
    coordinates: { latitude: 30, longitude: 31 },
    active: true,
    updatedAt: timestamp(),
  };
  await assertSucceeds(db("courier").doc("tracking/o1").set(record));
  await env.withSecurityRulesDisabled((c) =>
    c.firestore().doc("orders/o1").update({ orderStatus: "delivered" }),
  );
  await assertSucceeds(
    db("courier")
      .doc("tracking/o1")
      .update({ active: false, updatedAt: timestamp() }),
  );
  await assertFails(
    db("courier")
      .doc("tracking/o1")
      .update({ active: true, updatedAt: timestamp() }),
  );
});

test("multi-store kitchens can change only their own stage and must wait for every kitchen", async () => {
  await env.withSecurityRulesDisabled((context) => context.firestore().doc("orders/o1").update({
    orderStatus: "received", storeIds: ["s1", "s2"], kitchenStatus: { s1: "received", s2: "received" },
  }));
  const first = db("restaurant").doc("orders/o1");
  const second = db("other-restaurant").doc("orders/o1");
  await assertSucceeds(first.update({ orderStatus: "preparing", kitchenStatus: { s1: "preparing", s2: "received" }, updatedAt: timestamp() }));
  await assertFails(first.update({ orderStatus: "ready", kitchenStatus: { s1: "ready", s2: "ready" }, readyAt: timestamp(), updatedAt: timestamp() }));
  await assertFails(first.update({ orderStatus: "ready", kitchenStatus: { s1: "ready", s2: "received" }, readyAt: timestamp(), updatedAt: timestamp() }));
  await assertSucceeds(first.update({ orderStatus: "preparing", kitchenStatus: { s1: "ready", s2: "received" }, updatedAt: timestamp() }));
  await assertSucceeds(second.update({ orderStatus: "preparing", kitchenStatus: { s1: "ready", s2: "preparing" }, updatedAt: timestamp() }));
  await assertSucceeds(second.update({ orderStatus: "ready", kitchenStatus: { s1: "ready", s2: "ready" }, readyAt: timestamp(), updatedAt: timestamp() }));
  await assertFails(db("admin").doc("orders/o1").update({ orderStatus: "with_courier", updatedAt: timestamp() }));
});

test("OTP secrets are never readable or writable from any client role", async () => {
  await env.withSecurityRulesDisabled((context) => context.firestore().doc("orderSecrets/o1").set({ otpCode: "1234" }));
  for (const uid of ["customer", "restaurant", "courier", "admin"]) {
    await assertFails(db(uid).doc("orderSecrets/o1").get());
    await assertFails(db(uid).doc("orderSecrets/o1").set({ otpCode: "0000" }));
    await assertFails(db(uid).doc("orders/o1").update({ orderStatus: "delivered", deliveredAt: timestamp(), updatedAt: timestamp() }));
  }
});

test("a scoped realtime listener receives kitchen preparation and readiness", async () => {
  await env.withSecurityRulesDisabled((context) => context.firestore().doc("orders/o1").update({
    orderStatus: "received", kitchenStatus: { s1: "received" },
  }));
  const observed: string[] = [];
  let stop = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const ready = new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Realtime ready update timed out")), 8000);
    stop = db("restaurant").doc("orders/o1").onSnapshot((snapshot) => {
      const stage = snapshot.data()?.orderStatus;
      if (stage) observed.push(stage);
      if (stage === "ready") resolve();
    }, reject);
  });
  try {
    const order = db("restaurant").doc("orders/o1");
    await order.update({ orderStatus: "preparing", kitchenStatus: { s1: "preparing" }, updatedAt: timestamp() });
    await order.update({ orderStatus: "ready", kitchenStatus: { s1: "ready" }, readyAt: timestamp(), updatedAt: timestamp() });
    await ready;
    if (!observed.includes("preparing")) throw new Error("Missing realtime preparation update");
  } finally { stop(); clearTimeout(timer!); }
});

test("audit entries are admin-readable and cannot be forged, edited or deleted by any client", async()=>{
  await env.withSecurityRulesDisabled(c=>c.firestore().doc('auditLogs/e1').set({action:'user.create'}));
  await assertSucceeds(db('admin').doc('auditLogs/e1').get());
  await assertFails(db('customer').doc('auditLogs/e1').get());
  for(const uid of ['customer','admin']){await assertFails(db(uid).doc('auditLogs/e2').set({action:'forged'}));await assertFails(db(uid).doc('auditLogs/e1').delete());}
});
test("disabled accounts are denied even with a cached ID token",async()=>{
  await env.withSecurityRulesDisabled(c=>c.firestore().doc('accountAccess/customer').set({disabled:true,revokedBefore:0}));
  await assertFails(db('customer').doc('users/customer').get());
});

test('V2 tickets and queues cannot be read or forged directly, and merchants cannot read other stores in the parent order',async()=>{
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await db.doc('orders/o1').update({fulfillmentVersion:2});await db.doc('orders/o1/fulfillments/s1').set({storeId:'s1',items:[],status:'received'});await db.doc('stores/s1/preparationQueue/o1').set({active:true});await db.doc('appConfig/customerHome').set({config:{}});});
 await assertSucceeds(db('customer').doc('orders/o1').get());
 await assertSucceeds(db('admin').doc('orders/o1').get());
 await assertFails(db('restaurant').doc('orders/o1').get());
 for(const uid of ['customer','restaurant','other-restaurant','courier','admin']){
  for(const path of ['orders/o1/fulfillments/s1','stores/s1/preparationQueue/o1','courierAssignments/courier/orders/o1','appConfig/customerHome','promotions/forged']){
   await assertFails(db(uid).doc(path).get());await assertFails(db(uid).doc(path).set({active:true,status:'picked_up',role:'admin',caption:'x'.repeat(10000)}));
  }
 }
 await assertFails(db('customer').doc('orders/o1').update({orderStatus:'cancelled',updatedAt:timestamp()}));
 await assertFails(db('restaurant').doc('orders/o1').update({orderStatus:'preparing',kitchenStatus:{s1:'preparing'},updatedAt:timestamp()}));
 await assertFails(db('courier').doc('orders/o1').update({orderStatus:'with_courier',courierChecklist:{onTheWayToMinistry:true},updatedAt:timestamp()}));
 await assertFails(env.unauthenticatedContext().firestore().collection('appConfig').get());
 await assertFails(db('restaurant').collection('orders/o1/fulfillments').get());
 await assertFails(db('restaurant').doc('orders/missing/fulfillments/s1').get());
});

test('new preparation-only accounts cannot edit prices, create products, close stores or promote their own duty',async()=>{
 await env.withSecurityRulesDisabled(context=>context.firestore().doc('staff/restaurant').update({duty:'preparer'}));
 const product={id:'duty-product',storeId:'s1',storeName:'متجر',name:'منتج',description:'اختبار',price:10,category:'فطور',imageType:'foul',inStock:true,updatedAt:timestamp()};
 await assertFails(db('restaurant').doc('products/duty-product').set(product));
 await assertFails(db('restaurant').doc('stores/s1').update({status:'closed',updatedAt:timestamp()}));
 await assertFails(db('restaurant').doc('staff/restaurant').update({duty:'manager'}));
 await env.withSecurityRulesDisabled(context=>context.firestore().doc('staff/restaurant').update({duty:'manager'}));
 await assertSucceeds(db('restaurant').doc('products/duty-product').set(product));
});
