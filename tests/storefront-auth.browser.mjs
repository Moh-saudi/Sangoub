import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright";
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099")
  throw Error("Auth emulator required");
const server = spawn(
  process.execPath,
  ["--import", "tsx", "tests/admin-test-server.mjs"],
  {
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_PROJECT_ID: "demo-capital-talabat",
      VITE_FIREBASE_PROJECT_ID: "demo-capital-talabat",
      VITE_USE_FIREBASE_EMULATORS: "true",
    },
    stdio: "ignore",
  },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3105")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("sangoub_location_confirmed", "true");
    } catch {}
  });
  const page = await context.newPage();
  await page.route("**/api/app-content", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ slides: [], config: {} }),
    }),
  );
  await page.goto("http://127.0.0.1:3105/register");
  await page
    .getByRole("button", { name: "إنشاء حساب جديد", exact: true })
    .click();
  const email = "new-storefront-" + Date.now() + "@example.com";
  await page
    .getByPlaceholder("مثال: محمد مصطفى", { exact: true })
    .fill("عميل الاختبار");
  await page.locator("input[type=tel]").fill("01012345678");
  await page.getByPlaceholder("name@mail.com", { exact: true }).fill(email);
  await page.locator("input[type=password]").fill("TestPassword123!");
  await page
    .getByPlaceholder("اسم الشارع / الحي / المدينة / المبنى", { exact: true })
    .fill("عنوان الاختبار");
  await page
    .getByRole("button", { name: "إنشاء الحساب والبدء بالتسوق", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تم التأكيد، متابعة", exact: true })
    .waitFor();
  const records = await (
    await fetch(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-capital-talabat/oobCodes",
    )
  ).json();
  assert.ok(records.oobCodes.some((u) => u.email === email));
  assert.equal(
    await page.evaluate(() => localStorage.getItem("sangoub_user_profile")),
    null,
  );
  assert.equal(
    await page.getByText("20 ج.م هدية ترحيبية", { exact: false }).count(),
    0,
  );
  // Reuse the real cart UI with a persisted draft; it must preserve that draft until checkout acknowledgment.
  await page.goto("http://127.0.0.1:3105/");
  await page.evaluate(() => {
    localStorage.setItem(
      "sangoub_cart_items_v2",
      JSON.stringify([
        {
          id: "draft-line",
          product: {
            id: "test-product",
            storeId: "test-store",
            name: "منتج سلة الاختبار",
            price: 25,
          },
          quantity: 2,
          extraPrice: 0,
          selectedOptions: {},
        },
      ]),
    );
  });
  await page.reload();
  await page
    .getByRole("button", { name: "سلة المشتريات السريعة", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "سلة مشترياتك", exact: true })
    .waitFor();
  assert.equal(await page.locator("input[autocomplete=cc-number]").count(), 0);
  await page
    .getByRole("button", {
      name: "متابعة العنوان ومراجعة السعر والدفع",
      exact: true,
    })
    .click();
  await page.waitForURL("**/checkout");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("sangoub_cart_items_v2")).length,
    ),
    1,
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sangoub-web-cart-v1"))[0].productId,
    ),
    "test-product",
  );
  console.log(
    "Current storefront registration requests verification without fake wallet credit; cart drafts hand off to real checkout without premature clearing. Auth emulator only.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
