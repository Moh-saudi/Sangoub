import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright";
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw Error("Demo emulators required");
process.env.FIREBASE_PROJECT_ID = "demo-capital-talabat";
process.env.FIREBASE_DATABASE_ID = "(default)";
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
const { adminServices } = await import("../server/firebaseAdmin.ts"),
  service = adminServices(),
  users = {};
for (const role of ["admin", "employee", "restaurant", "courier"]) {
  const user = await service.auth.createUser({
    email: `access-${role}@example.com`,
    emailVerified: true,
    password: "TestPassword123!",
  });
  users[role] = user;
  if (role === "admin")
    await service.db.doc("admins/" + user.uid).set({ enabled: true });
  if (["restaurant", "courier"].includes(role))
    await service.db
      .doc("staff/" + user.uid)
      .set({
        role,
        name: role,
        ...(role === "restaurant"
          ? { storeId: "access-store", duty: "manager" }
          : {}),
      });
}
await service.db
  .doc("stores/access-store")
  .set({ name: "متجر صلاحيات الاختبار", status: "open" });
await service.db
  .doc("products/access-product")
  .set({
    storeId: "access-store",
    name: "منتج المتجر",
    price: 10,
    inStock: true,
  });
const server = spawn(
  process.execPath,
  ["--import", "tsx", "tests/admin-test-server.mjs"],
  {
    env: {
      ...process.env,
      VITE_USE_FIREBASE_EMULATORS: "true",
      VITE_FIREBASE_PROJECT_ID: "demo-capital-talabat",
    },
    stdio: "ignore",
  },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3105/admin")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  for (const role of ["employee", "restaurant", "courier", "admin"]) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      page = await context.newPage();
    await page.goto("http://127.0.0.1:3105/admin");
    await page
      .getByLabel("البريد الإلكتروني", { exact: true })
      .fill(`access-${role}@example.com`);
    await page
      .getByLabel("كلمة المرور", { exact: true })
      .fill("TestPassword123!");
    await page
      .getByRole("button", { name: "دخول لوحة الإدارة", exact: true })
      .click();
    if (role === "admin") {
      // Mobile navigation is intentionally hidden until the administrator opens it.
      await page.getByRole("button", { name: "أقسام الإدارة", exact: true }).click();
      await page
        .getByRole("navigation", { name: "أقسام إدارة التشغيل", exact: true })
        .waitFor();
      await page.getByRole('button',{name:'سجل المناديب والتجار والمستخدمين',exact:true}).click();
      await page.getByRole('button',{name:'+ إضافة قيد معتمد جديد',exact:true}).click();
      const accountForm=page.locator('#user-mgmt-form');
      await accountForm.locator('[name=role]').selectOption('employee');
      await accountForm.locator('[name=fullName]').fill('حساب اختبار تعيين كلمة المرور');
      await accountForm.locator('[name=email]').fill('ui-password-setup@example.com');
      await accountForm.locator('[name=reason]').fill('اختبار إنشاء حساب وتعيين كلمة المرور بشكل خاص');
      await page.getByRole('button',{name:'حفظ وقيد السجل المعتمَد',exact:true}).click();
      const accessDialog=page.getByRole('dialog',{name:'تعيين كلمة مرور الحساب',exact:true});
      await accessDialog.waitFor();
      assert.equal(await page.locator('#user-mgmt-form').count(),0,'Creation form must close after success to avoid duplicate account creation');
      assert.equal(await accessDialog.getByRole('button',{name:'نسخ رابط تعيين كلمة المرور',exact:true}).count(),1);
      await accessDialog.getByRole('button',{name:'تم، إغلاق',exact:true}).click();
      await service.db.doc("admins/" + users.admin.uid).delete();
      await page
        .getByRole("heading", { name: "الحساب غير مخوّل للإدارة", exact: true })
        .waitFor();
    } else
      await page
        .getByRole("heading", { name: "الحساب غير مخوّل للإدارة", exact: true })
        .waitFor();
    await context.close();
  }
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto("http://127.0.0.1:3105/merchant");
  await page.locator("#merchant-email").fill("access-restaurant@example.com");
  await page.locator("#merchant-password").fill("TestPassword123!");
  await page.getByRole("button", { name: "دخول التاجر", exact: true }).click();
  await page
    .getByRole("heading", { name: "متجر صلاحيات الاختبار", exact: true })
    .first()
    .waitFor();
  await service.db.doc("staff/" + users.restaurant.uid).delete();
  await page
    .getByRole("heading", { name: "حساب غير مصرح له كتاجر", exact: true })
    .waitFor();
  await context.close();
  const courierContext=await browser.newContext({viewport:{width:390,height:844}}),courierPage=await courierContext.newPage();
  await courierPage.goto('http://127.0.0.1:3105/courier');
  await courierPage.getByLabel('البريد الإلكتروني',{exact:true}).fill('access-courier@example.com');
  await courierPage.getByLabel('كلمة المرور',{exact:true}).fill('TestPassword123!');
  await courierPage.getByRole('button',{name:'دخول المندوب',exact:true}).click();
  await courierPage.getByRole('heading',{name:'مهام التوصيل',exact:true}).waitFor();
  const {writeOrderSignals}=await import('../server/orderSignals.ts');
  const assigned={id:'courier-browser-order',orderNumber:'CUR-BROWSER',storeIds:['access-store'],courierId:users.courier.uid,orderStatus:'ready',paymentMethod:'cash',paymentStatus:'cash_on_delivery',total:25,profileId:users.employee.uid,profileName:'عميل التوصيل',phone:'01012345678',ministry:'عنوان الاختبار',floorNumber:'1',roomNumber:'2',items:[{id:'item',quantity:1,extraPrice:0,product:{id:'access-product',name:'منتج المهمة',storeId:'access-store',storeName:'متجر صلاحيات الاختبار',price:25}}]};
  await service.db.runTransaction(async tx=>{tx.set(service.db.doc('orders/'+assigned.id),assigned);tx.set(service.db.doc('orderSecrets/'+assigned.id),{otpCode:'1234',attempts:0});writeOrderSignals(service.db,tx,assigned);});
  await courierPage.getByRole('heading',{name:'طلب CUR-BROWSER',exact:true}).waitFor();
  await courierPage.getByLabel('راجعت الأصناف والكميات عند الاستلام').check();
  await courierPage.getByRole('button',{name:'تأكيد استلام الطلب',exact:true}).click();
  await courierPage.getByRole('button',{name:'بدء التوصيل للعميل',exact:true}).click();
  await courierPage.getByLabel('رمز تسليم CUR-BROWSER',{exact:true}).fill('1234');
  await courierPage.getByLabel('حصّلت قيمة الطلب كاملة وسلّمت الأصناف').check();
  await courierPage.getByRole('button',{name:'تأكيد التسليم بالرمز',exact:true}).click();
  await courierPage.getByText('لا توجد مهام نشطة مسندة إليك.',{exact:false}).waitFor();
  assert.equal((await service.db.doc('orders/'+assigned.id).get()).data().orderStatus,'delivered');
  await courierPage.getByRole('button',{name:'سجل التوصيل',exact:true}).click();
  await courierPage.getByRole('heading',{name:'طلب CUR-BROWSER',exact:true}).waitFor();
  assert.equal(await courierPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await service.db.doc('staff/'+users.courier.uid).delete();
  await courierPage.getByText('هذا الحساب غير معتمد كمندوب، أو تعذر التحقق من الصلاحية.',{exact:true}).waitFor();
  assert.equal(await courierPage.getByText('CUR-BROWSER',{exact:false}).count(),0);
  await courierContext.close();
  console.log(
    "Current admin and merchant entrypoints: role separation, admin admission and live membership revocation passed. Demo accounts only.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
