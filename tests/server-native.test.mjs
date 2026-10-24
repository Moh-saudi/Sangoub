import { serverEntry } from "../server/serverEntry.js";
import users from "../api/admin-users.ts";
import data from "../api/admin-data.ts";
// Run without tsx: production ESM must load without a development loader.
import test from "node:test";
import assert from "node:assert/strict";
import operations from "../api/operations.ts";
import appContent from "../api/app-content.ts";
import orders from "../api/orders.ts";
import images from "../api/catalog-images.ts";
import delivery from "../api/order-delivery.ts";
import assistant from "../api/gemini/[action].ts";

for (const [name, handler] of Object.entries({ orders, images, delivery, assistant, users, data, operations, appContent })) {
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

test("server entry reports an import incident without exposing its raw message",async()=>{
 let status,body;const handler=serverEntry(async()=>{throw Object.assign(new Error('example-internal-path'),{code:'ERR_MODULE_NOT_FOUND'});});
 await handler({method:'POST',headers:{authorization:'Bearer synthetic-test-token'}},{setHeader(){},status(value){status=value;return this},json(value){body=value;return this}});
 assert.equal(status,503);assert.equal(body.code,'SERVER_MODULE_LOAD_FAILED');assert.equal(JSON.stringify(body).includes('example-internal-path'),false);assert(body.incidentId);
});
