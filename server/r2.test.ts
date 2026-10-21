import test from "node:test";
import assert from "node:assert/strict";
import { imageUploadSpec, validImageKey } from "./r2.ts";
import handler from "../api/catalog-images.ts";

test("R2 uploads use a generated catalog key with correct extension", () => {
  const input = { collection: "stores", id: "real-store", contentType: "image/png", size: 100 };
  const first = imageUploadSpec(input);
  assert.equal(validImageKey(first.key), true);
  assert.match(first.key, /^catalog\/stores\/real-store\/.+\.png$/);
  assert.notEqual(first.key, imageUploadSpec(input).key);
});
test("rejects unsupported types, oversize files and arbitrary object paths", () => {
  const input = { collection: "products", id: "real-product", contentType: "image/webp", size: 100 };
  for (const change of [{ size: 0 }, { size: 5242881 }, { size: 1.2 }, { contentType: "image/svg+xml" }, { contentType: "toString" }, { id: "../private" }, { collection: "admins" }])
    assert.throws(() => imageUploadSpec({ ...input, ...change }));
  assert.equal(validImageKey("private/file.png"), false);
  assert.equal(validImageKey("catalog/stores/../test.png"), false);
});
test("image signing requires authentication before accessing cloud services", async () => {
  const res = { code: 0, setHeader() {}, status(code: number) { this.code = code; return this; }, json() {} };
  await handler({ method: "POST", headers: {}, body: { action: "upload" } }, res);
  assert.equal(res.code, 401);
});
