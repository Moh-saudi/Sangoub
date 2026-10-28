import test from "node:test";
import assert from "node:assert/strict";
import {
  haversineDistanceMeters,
  estimateFallbackRoute,
  hasDeviatedFromRoute,
  calculateOsmRoute,
  OSM_CONFIG,
} from "./osmRouting.ts";

test("haversineDistanceMeters accurately measures known distance in Cairo / NAC", () => {
  // Food Court to R3 NAC
  const p1 = { latitude: 30.0165, longitude: 31.742 };
  const p2 = { latitude: 30.038, longitude: 31.715 };
  const distance = haversineDistanceMeters(p1, p2);

  // Approximately 3.4 km
  assert.ok(distance > 3000 && distance < 3800, `Distance was ${distance}`);
});

test("estimateFallbackRoute applies 30% curvature factor and generates reasonable duration", () => {
  const from = { latitude: 30.0, longitude: 31.0 };
  const to = { latitude: 30.05, longitude: 31.05 };

  const fallback = estimateFallbackRoute(from, to);
  const straight = haversineDistanceMeters(from, to);

  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.distanceMeters, Math.round(straight * 1.3));
  assert.ok(fallback.durationSeconds >= 60);
  assert.equal(fallback.polyline.length, 2);
  assert.equal(fallback.polyline[0][0], from.latitude);
  assert.equal(fallback.polyline[1][0], to.latitude);
});

test("hasDeviatedFromRoute accurately detects deviation threshold", () => {
  const polyline: [number, number][] = [
    [30.0, 31.0],
    [30.01, 31.01],
    [30.02, 31.02],
  ];

  // Point very close to segment (within 20m)
  const onRoute = { latitude: 30.0001, longitude: 31.0001 };
  assert.equal(hasDeviatedFromRoute(onRoute, polyline, 50), false);

  // Point far away (more than 1km)
  const deviated = { latitude: 30.05, longitude: 31.05 };
  assert.equal(hasDeviatedFromRoute(deviated, polyline, 50), true);
});

test("calculateOsmRoute falls back gracefully when network fails or times out", async () => {
  const from = { latitude: 30.0165, longitude: 31.742 };
  const to = { latitude: 30.038, longitude: 31.715 };

  // Should succeed either with live route or fallback without throwing an exception
  const result = await calculateOsmRoute(from, to, { timeoutMs: 1000 });
  assert.ok(result.distanceMeters > 0);
  assert.ok(result.durationSeconds > 0);
  assert.ok(result.polyline.length >= 2);
});

test("OSM_CONFIG exposes valid tileUrl and attribution", () => {
  assert.ok(OSM_CONFIG.tileUrl.includes("tile.openstreetmap.org") || OSM_CONFIG.tileUrl.includes("{z}"));
  assert.ok(OSM_CONFIG.attribution.includes("OpenStreetMap"));
});

