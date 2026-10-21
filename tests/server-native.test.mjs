// Run without tsx: production ESM must load without a development loader.
import test from "node:test";
import assert from "node:assert/strict";
import orders from "../api/orders.ts";
import images from "../api/catalog-images.ts";
import delivery from "../api/order-delivery.ts";
import assistant from "../api/gemini/[action].ts";

for (const [name, handler] of Object.entries({ orders, images, delivery, assistant })) {
  test(`native ESM loads ${name} and rejects unauthenticated requests before cloud access`, async () => {
    const response = {
      statusCode: 0,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json() { return this; },
    };
    await handler({ method: "POST", headers: {}, body: {} }, response);
    assert.equal(response.statusCode, 401);
  });
}
