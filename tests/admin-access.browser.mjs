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
      await page
        .getByRole("navigation", { name: "أقسام إدارة التشغيل", exact: true })
        .waitFor();
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
  console.log(
    "Current admin and merchant entrypoints: role separation, admin admission and live membership revocation passed. Demo accounts only.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
