/**
 * Location tracking filter for the courier PWA.
 *
 * Pure logic, no browser APIs: the caller passes the current time in, so it can
 * be unit-tested with a fake clock. Output payload is exactly what the current
 * Firestore rules accept for /tracking/{orderId}: { coordinates, active }.
 *
 * Usage from the component:
 *   filter.start(Date.now())                         // when sharing begins
 *   watchPosition(pos => filter.evaluate({...}, Date.now()))
 *   setInterval(() => filter.heartbeat(Date.now()), 10_000)
 *   watchPosition error callback -> filter.markGpsError()
 */

export interface RawReading {
  latitude: number;
  longitude: number;
  /** meters; a missing value is treated as unusable */
  accuracy?: number;
  /** position.timestamp (ms epoch) - when the fix was taken */
  timestamp?: number;
}

export interface TrackingPayload {
  coordinates: { latitude: number; longitude: number };
  active: true;
}

export interface FilterConfig {
  minIntervalMs: number;
  distanceFilterMeters: number;
  heartbeatMs: number;
  goodAccuracyMeters: number;
  degradedAccuracyMeters: number;
  /** accept a degraded-accuracy fix once nothing was accepted for this long */
  degradedAfterMs: number;
  maxSpeedKmh: number;
  /** after this long without an accepted point the jump baseline is dropped */
  outageResetMs: number;
  /** readings older than this (cached/stale fixes) are ignored */
  maxReadingAgeMs: number;
  /** stop heartbeats if the GPS has produced nothing for this long */
  gpsStaleMs: number;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  minIntervalMs: 10_000,
  distanceFilterMeters: 20,
  heartbeatMs: 60_000,
  goodAccuracyMeters: 30,
  degradedAccuracyMeters: 100,
  degradedAfterMs: 60_000,
  maxSpeedKmh: 90,
  outageResetMs: 120_000,
  maxReadingAgeMs: 30_000,
  gpsStaleMs: 300_000,
};

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Fix {
  lat: number;
  lng: number;
  /** time the fix was taken (reading time) */
  t: number;
}

export class LocationTrackingFilter {
  private readonly cfg: FilterConfig;
  private last: Fix | null = null; // last accepted (= last sent) position
  private startedAt = 0;
  private lastAcceptedAt = 0; // wall time of last accepted *reading*
  private lastSentAt = 0; // wall time of last send (reading or heartbeat)
  private lastSeenAt = 0; // wall time of any reading, accepted or not
  private gpsError = false;

  constructor(config: Partial<FilterConfig> = {}) {
    this.cfg = { ...DEFAULT_FILTER_CONFIG, ...config };
  }

  /** Call when sharing begins (and when a new order starts). */
  start(now: number): void {
    this.last = null;
    this.startedAt = now;
    this.lastAcceptedAt = now;
    this.lastSentAt = 0;
    this.lastSeenAt = now;
    this.gpsError = false;
  }

  /** Call from the watchPosition error callback (permission lost, no signal). */
  markGpsError(): void {
    this.gpsError = true;
  }

  /** Returns a payload to write, or null if the reading should be skipped. */
  evaluate(reading: RawReading, now: number): TrackingPayload | null {
    this.lastSeenAt = now;
    this.gpsError = false;

    const t = reading.timestamp ?? now;
    if (now - t > this.cfg.maxReadingAgeMs) return null; // stale cached fix

    // 1) accuracy
    const accuracy = reading.accuracy ?? Number.POSITIVE_INFINITY;
    if (accuracy > this.cfg.goodAccuracyMeters) {
      const sinceAccepted = now - this.lastAcceptedAt;
      const degradedOk =
        accuracy <= this.cfg.degradedAccuracyMeters &&
        sinceAccepted >= this.cfg.degradedAfterMs;
      if (!degradedOk) return null;
    }

    // 2) jump / speed check against the last accepted fix
    if (this.last) {
      const gapMs = t - this.last.t;
      if (gapMs <= 0) return null; // out of order
      const dist = distanceMeters(
        this.last.lat,
        this.last.lng,
        reading.latitude,
        reading.longitude,
      );
      if (gapMs < this.cfg.outageResetMs) {
        const speedKmh = (dist / (gapMs / 1000)) * 3.6;
        if (speedKmh > this.cfg.maxSpeedKmh) return null; // GPS teleport
      }
      // 3) interval + distance, or heartbeat due
      const sinceSent = now - this.lastSentAt;
      const heartbeatDue = sinceSent >= this.cfg.heartbeatMs;
      const intervalOk = sinceSent >= this.cfg.minIntervalMs;
      const moved = dist >= this.cfg.distanceFilterMeters;
      if (!heartbeatDue && !(intervalOk && moved)) return null;
    }

    this.last = { lat: reading.latitude, lng: reading.longitude, t };
    this.lastAcceptedAt = now;
    this.lastSentAt = now;
    return this.payload();
  }

  /**
   * Call from a timer. Re-sends the last accepted position when nothing was
   * sent for heartbeatMs (e.g. the courier is standing still and the browser
   * fires no position events). Returns null when it should stay silent.
   */
  heartbeat(now: number): TrackingPayload | null {
    if (!this.last || this.gpsError) return null;
    if (now - this.lastSeenAt > this.cfg.gpsStaleMs) return null;
    if (now - this.lastSentAt < this.cfg.heartbeatMs) return null;
    this.lastSentAt = now;
    return this.payload();
  }

  private payload(): TrackingPayload {
    const last = this.last as Fix;
    return {
      coordinates: { latitude: last.lat, longitude: last.lng },
      active: true,
    };
  }
}
