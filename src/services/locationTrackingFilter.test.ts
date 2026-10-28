import test from "node:test";
import assert from "node:assert/strict";
import {
  LocationTrackingFilter,
  distanceMeters,
} from "./locationTrackingFilter.ts";

const T0 = 1_000_000;
const LAT = 30.0165;
const LNG = 31.742;
const M = 1 / 111_320; // degrees of latitude per meter

const at = (northMeters: number, accuracy: number | undefined, t: number) => ({
  latitude: LAT + northMeters * M,
  longitude: LNG,
  accuracy,
  timestamp: t,
});

function started() {
  const f = new LocationTrackingFilter();
  f.start(T0);
  return f;
}

test("first good reading is accepted and payload matches Firestore rules shape", () => {
  const f = started();
  const p = f.evaluate(at(0, 10, T0), T0);
  assert.deepEqual(p, {
    coordinates: { latitude: LAT, longitude: LNG },
    active: true,
  });
  assert.deepEqual(Object.keys(p!).sort(), ["active", "coordinates"]);
});

test("reading without accuracy is ignored", () => {
  const f = started();
  assert.equal(f.evaluate(at(0, undefined, T0), T0), null);
});

test("poor accuracy is ignored at first, degraded (<100m) accepted after 60s, >100m never", () => {
  const f = started();
  assert.equal(f.evaluate(at(0, 50, T0 + 1000), T0 + 1000), null);
  assert.notEqual(f.evaluate(at(0, 50, T0 + 61_000), T0 + 61_000), null);

  const g = started();
  assert.equal(g.evaluate(at(0, 150, T0 + 70_000), T0 + 70_000), null);
});

test("requires both >=10s and >=20m for a normal update", () => {
  const f = started();
  assert.notEqual(f.evaluate(at(0, 10, T0), T0), null);
  assert.equal(f.evaluate(at(30, 10, T0 + 5_000), T0 + 5_000), null); // too soon
  assert.equal(f.evaluate(at(5, 10, T0 + 10_000), T0 + 10_000), null); // too close
  assert.notEqual(f.evaluate(at(30, 10, T0 + 12_000), T0 + 12_000), null);
});

test("stationary courier: reading-driven heartbeat fires at 60s", () => {
  const f = started();
  f.evaluate(at(0, 10, T0), T0);
  for (let s = 10; s < 60; s += 10) {
    assert.equal(f.evaluate(at(0, 10, T0 + s * 1000), T0 + s * 1000), null);
  }
  assert.notEqual(f.evaluate(at(0, 10, T0 + 60_000), T0 + 60_000), null);
});

test("timer heartbeat re-sends last position with no new GPS reading", () => {
  const f = started();
  const first = f.evaluate(at(0, 10, T0), T0);
  assert.equal(f.heartbeat(T0 + 59_000), null);
  assert.deepEqual(f.heartbeat(T0 + 60_000), first);
  assert.equal(f.heartbeat(T0 + 61_000), null); // timer resets after a send
  assert.deepEqual(f.heartbeat(T0 + 120_000), first);
});

test("heartbeat stays silent before any fix, after GPS error, and when GPS is long dead", () => {
  const f = started();
  assert.equal(f.heartbeat(T0 + 120_000), null); // no fix yet

  f.evaluate(at(0, 10, T0), T0);
  f.markGpsError();
  assert.equal(f.heartbeat(T0 + 120_000), null);

  const g = started();
  g.evaluate(at(0, 10, T0), T0);
  assert.notEqual(g.heartbeat(T0 + 200_000), null);
  assert.equal(g.heartbeat(T0 + 301_000), null); // >300s since any reading
});

test("unrealistic speed jump is rejected without disturbing the baseline", () => {
  const f = started();
  f.evaluate(at(0, 10, T0), T0);
  assert.equal(f.evaluate(at(5_000, 10, T0 + 20_000), T0 + 20_000), null);
  // a sane point afterwards is still compared with the original baseline
  assert.notEqual(f.evaluate(at(30, 10, T0 + 30_000), T0 + 30_000), null);
});

test("jump baseline resets only after the outage threshold (120s)", () => {
  const f = started();
  f.evaluate(at(0, 10, T0), T0);
  assert.equal(f.evaluate(at(5_000, 10, T0 + 100_000), T0 + 100_000), null);
  assert.notEqual(f.evaluate(at(5_000, 10, T0 + 121_000), T0 + 121_000), null);
});

test("stale cached fix and out-of-order fix are ignored", () => {
  const f = started();
  assert.equal(f.evaluate(at(0, 10, T0 - 40_000), T0), null); // 40s old

  f.evaluate(at(0, 10, T0), T0);
  assert.equal(
    f.evaluate(at(30, 10, T0 - 5_000), T0 + 15_000),
    null,
  ); // older than the last accepted fix
});

test("start() clears previous state", () => {
  const f = started();
  f.evaluate(at(0, 10, T0), T0);
  f.start(T0 + 500_000);
  assert.equal(f.heartbeat(T0 + 700_000), null); // no fix after restart
  assert.notEqual(
    f.evaluate(at(5_000, 10, T0 + 500_000), T0 + 500_000),
    null,
  ); // no stale baseline -> no false jump
});

test("distanceMeters is accurate for a known ~30m offset", () => {
  const d = distanceMeters(LAT, LNG, LAT + 30 * M, LNG);
  assert.ok(Math.abs(d - 30) < 0.5, `got ${d}`);
});