/**
 * OpenStreetMap & OSRM Routing Service for Sangoub Platform
 * Provides road-network routing, accurate ETA, caching, deviation checking, and graceful Haversine fallback.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: [number, number][]; // [latitude, longitude]
  isFallback: boolean;
  calculatedAt: number;
}

export const OSM_CONFIG = {
  get tileUrl(): string {
    return (
      (import.meta as any).env?.VITE_TILE_URL ||
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    );
  },
  get osrmUrl(): string {
    return (
      (import.meta as any).env?.VITE_OSRM_URL ||
      "https://router.project-osrm.org/route/v1/driving"
    );
  },
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
};

// In-memory route cache (Key -> { result, expiresAt })
const routeCache = new Map<string, { result: RouteResult; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function createCacheKey(from: Coordinates, to: Coordinates): string {
  return `${from.latitude.toFixed(4)},${from.longitude.toFixed(4)}->${to.latitude.toFixed(4)},${to.longitude.toFixed(4)}`;
}

/**
 * Standard Haversine straight-line distance in meters.
 */
export function haversineDistanceMeters(p1: Coordinates, p2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLng = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fallback route estimation when OSRM routing is unavailable or timed out.
 * Adds 30% road-curvature factor over Haversine and assumes 35 km/h courier speed.
 */
export function estimateFallbackRoute(from: Coordinates, to: Coordinates): RouteResult {
  const straightMeters = haversineDistanceMeters(from, to);
  const roadMeters = Math.round(straightMeters * 1.3); // 30% curvature factor for city navigation
  const averageSpeedMetersPerSec = (35 * 1000) / 3600; // 35 km/h
  const durationSeconds = Math.max(60, Math.round(roadMeters / averageSpeedMetersPerSec));

  return {
    distanceMeters: roadMeters,
    durationSeconds,
    polyline: [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude],
    ],
    isFallback: true,
    calculatedAt: Date.now(),
  };
}

/**
 * Checks whether current courier position has deviated more than `thresholdMeters` (default: 50m) from existing polyline.
 */
export function hasDeviatedFromRoute(
  currentPos: Coordinates,
  polyline: [number, number][],
  thresholdMeters: number = 50
): boolean {
  if (!polyline || polyline.length === 0) return true;

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const pt: Coordinates = { latitude: polyline[i][0], longitude: polyline[i][1] };
    const dist = haversineDistanceMeters(currentPos, pt);
    if (dist < minDistance) {
      minDistance = dist;
    }
    if (minDistance <= thresholdMeters) {
      return false; // Within allowed corridor
    }
  }

  return minDistance > thresholdMeters;
}

/**
 * Computes road navigation route between two points using OSRM with automatic caching and graceful fallback.
 */
export async function calculateOsmRoute(
  from: Coordinates,
  to: Coordinates,
  options: { forceRecalculate?: boolean; timeoutMs?: number } = {}
): Promise<RouteResult> {
  const key = createCacheKey(from, to);
  const cached = routeCache.get(key);

  if (!options.forceRecalculate && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const timeoutMs = options.timeoutMs || 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const baseUrl = OSM_CONFIG.osrmUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`OSRM HTTP status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route returned from OSRM");
    }

    const primaryRoute = data.routes[0];
    // GeoJSON coordinates are [longitude, latitude] -> convert to Leaflet [latitude, longitude]
    const polyline: [number, number][] = primaryRoute.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]]
    );

    const result: RouteResult = {
      distanceMeters: Math.round(primaryRoute.distance),
      durationSeconds: Math.round(primaryRoute.duration),
      polyline,
      isFallback: false,
      calculatedAt: Date.now(),
    };

    routeCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    clearTimeout(timer);
    const fallback = estimateFallbackRoute(from, to);
    // Cache fallback briefly (60 seconds) to prevent hammering when offline
    routeCache.set(key, { result: fallback, expiresAt: Date.now() + 60 * 1000 });
    return fallback;
  }
}

