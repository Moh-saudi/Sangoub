import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import "firebase/compat/storage";
import "firebase/compat/firestore";

let env: RulesTestEnvironment;
const path = "catalog/stores/store1/logo.png";
const bytes = new Uint8Array([137, 80, 78, 71]);
const storage = (uid?: string, verified = true) => (uid
  ? env.authenticatedContext(uid, { email_verified: verified })
  : env.unauthenticatedContext()).storage();
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-capital-talabat",
    firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") },
    storage: { host: "127.0.0.1", port: 9199, rules: readFileSync("storage.rules", "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("admins/admin").set({ enabled: true });
  });
});
test("verified admin can upload catalog image and public can view it", async () => {
  await assertSucceeds(Promise.resolve(storage("admin").ref(path).put(bytes, { contentType: "image/png" }))).catch(e => { throw new Error("upload: " + e.message); });
  await assertSucceeds(storage().ref(path).getMetadata()).catch(e => { throw new Error("read: " + e.message); });
  await assertSucceeds(storage("admin").ref(path).delete()).catch(e => { throw new Error("delete: " + e.message); });
});
test("customer, anonymous user and unverified admin cannot upload", async () => {
  for (const context of [storage(), storage("customer"), storage("admin", false)]) {
    await assertFails(Promise.resolve(context.ref(path).put(bytes, { contentType: "image/png" })));
  }
});
test("rejects SVG, oversized files and paths outside catalog", async () => {
  const admin = storage("admin");
  await assertFails(Promise.resolve(admin.ref(path).put(bytes, { contentType: "image/svg+xml" })));
  await assertFails(Promise.resolve(admin.ref(path).put(new Uint8Array(5 * 1024 * 1024 + 1), { contentType: "image/png" })));
  await assertFails(Promise.resolve(admin.ref("private/logo.png").put(bytes, { contentType: "image/png" })));
});
test("revoking admin membership removes upload permission", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("admins/admin").delete();
  });
  await assertFails(Promise.resolve(storage("admin").ref(path).put(bytes, { contentType: "image/png" })));
});
test("phone-verified admin can upload product image; customers cannot delete it", async () => {
  const target = "catalog/products/product1/photo.webp";
  const admin = env.authenticatedContext("admin", { phone_number: "+201012345678" }).storage();
  await assertSucceeds(Promise.resolve(admin.ref(target).put(bytes, { contentType: "image/webp" })));
  await assertFails(storage("customer").ref(target).delete());
});
