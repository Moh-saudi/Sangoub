import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = "http://127.0.0.1:3112";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "3112",
    "--strictPort",
  ],
  { stdio: "ignore" },
);
const htmlPath = new URL("../dist/index.html", import.meta.url),
  originalHtml = await readFile(htmlPath, "utf8");
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + "/admin");
  await page
    .getByRole("heading", { name: "تسجيل دخول الإدارة", exact: true })
    .waitFor();
  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (registration.active?.state !== "activated")
      await new Promise((resolve, reject) => {
        const worker =
          registration.installing ||
          registration.waiting ||
          registration.active;
        const timeout = setTimeout(
          () => reject(Error("activation timeout")),
          15000,
        );
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    const keys = await caches.keys();
    const urls = (
      await Promise.all(
        keys
          .filter((k) => k.includes("precache"))
          .map(async (k) =>
            (await (await caches.open(k)).keys()).map((r) => r.url),
          ),
      )
    ).flat();
    return { active: registration.active?.state, urls };
  });
  assert.equal(result.active, "activated");
  assert.equal(
    result.urls.filter((u) => u.includes("/brand/sangoub-mark-white-512.png"))
      .length,
    1,
  );
  assert.ok(result.urls.length < 40, "Only essential assets are precached");
  await page.reload();
  await writeFile(
    htmlPath,
    originalHtml.replace(
      "</head>",
      '<meta name="navigation-probe" content="new-release"></head>',
    ),
  );
  await page.reload();
  assert.equal(
    await page.locator("meta[name=navigation-probe]").getAttribute("content"),
    "new-release",
  );
  await page.waitForFunction(async () => {
    const cache = await caches.open("capital-page-navigation");
    const response = await cache.match(location.href);
    return response && (await response.text()).includes("navigation-probe");
  });
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("heading", { name: "تسجيل دخول الإدارة", exact: true })
    .waitFor();
  assert.equal(
    await page.locator("meta[name=navigation-probe]").getAttribute("content"),
    "new-release",
  );
  await context.setOffline(false);
  await writeFile(htmlPath, originalHtml);
  await page.reload();
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  const manifest = await page.evaluate(async () =>
    fetch(document.querySelector("link[rel=manifest]").href).then((r) =>
      r.json(),
    ),
  );
  assert.match(manifest.name, /سنجوب/);
  assert.ok(manifest.icons.every((i) => i.src.includes("sangoub-mark-white")));
  console.log(
    "Current admin PWA: essential precache, one logo revision, network HTML refresh, offline navigation and responsive layout passed.",
  );
} finally {
  await writeFile(htmlPath, originalHtml);
  await browser?.close();
  server.kill("SIGTERM");
}
