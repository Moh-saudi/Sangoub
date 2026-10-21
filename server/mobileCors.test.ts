import test from "node:test";
import assert from "node:assert/strict";
import ordersHandler from "../api/orders.ts";

function response() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.statusCode = code; return this; },
    end() { return this; },
    json(_body: unknown) { return this; },
  };
}

test("native mobile preflight permits sending Firebase bearer tokens", async () => {
  for (const origin of ["https://localhost", "capacitor://localhost"]) {
    const res = response();
    await ordersHandler({ method: "OPTIONS", headers: { origin } }, res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], origin);
    assert.match(res.headers["Access-Control-Allow-Headers"], /Authorization/);
  }
});

test("unrecognized origins do not receive CORS permission", async () => {
  const res = response();
  await ordersHandler({ method: "OPTIONS", headers: { origin: "https://untrusted.example" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers["Access-Control-Allow-Origin"], undefined);
});

test("permitted mobile origin cannot bypass Firebase authentication", async () => {
  const res = response();
  await ordersHandler({ method: "POST", headers: { origin: "https://localhost" }, body: {} }, res);
  assert.equal(res.statusCode, 401);
});
