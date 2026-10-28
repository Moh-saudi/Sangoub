import {requestOsm,type OsmClientOptions} from './osmClient';
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
      "/api/osm/route"
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

  // Measure point-to-segment distance, not just distance to sparse route vertices.
  const scale=111320,cos=Math.cos(currentPos.latitude*Math.PI/180);
  const projected=polyline.map(([lat,lng])=>[(lng-currentPos.longitude)*scale*cos,(lat-currentPos.latitude)*scale]);
  let minDistance=Infinity;
  for(let i=0;i<projected.length;i++){
    const a=projected[i],b=projected[Math.min(i+1,projected.length-1)],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=dx*dx+dy*dy?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy))):0;
    minDistance=Math.min(minDistance,Math.hypot(a[0]+t*dx,a[1]+t*dy));
  }

  return minDistance > thresholdMeters;
}

/**
 * Computes road navigation route between two points using OSRM with automatic caching and graceful fallback.
 */
export async function calculateOsmRoute(
  from: Coordinates,
  to: Coordinates,
  options: OsmClientOptions & { forceRecalculate?: boolean; timeoutMs?: number } = {}
): Promise<RouteResult> {
  const key = createCacheKey(from, to);
  const cached = routeCache.get(key);

  if (!options.forceRecalculate && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const timeoutMs = options.timeoutMs || 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)controller.abort();
  let cancel:()=>void=()=>{};
  const aborted=new Promise<never>((_,reject)=>{cancel=()=>reject(new DOMException('Aborted','AbortError'));controller.signal.addEventListener('abort',cancel,{once:true});if(controller.signal.aborted)cancel();});
  try {
    const data=await Promise.race([requestOsm('route',{from,to},{...options,signal:controller.signal}),aborted]);
    if(!Number.isFinite(data.distanceMeters)||data.distanceMeters<0||!Number.isFinite(data.durationSeconds)||data.durationSeconds<0||!Array.isArray(data.polyline)||data.polyline.length<2||data.polyline.some((p:any)=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>90||Math.abs(p[1])>180))throw Error('Invalid route');
    const result:RouteResult={distanceMeters:Math.round(data.distanceMeters),durationSeconds:Math.round(data.durationSeconds),polyline:data.polyline,isFallback:false,calculatedAt:Date.now()};
    if(routeCache.size>=100)routeCache.delete(routeCache.keys().next().value!);
    routeCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    clearTimeout(timer);
    const fallback = estimateFallbackRoute(from, to);
    // Cache fallback briefly (60 seconds) to prevent hammering when offline
    routeCache.set(key, { result: fallback, expiresAt: Date.now() + 60 * 1000 });
    return fallback;
  } finally {clearTimeout(timer);options.signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',cancel);}
}


/** One planner per journey: recalculate only on departure/destination change or >50m deviation. */
export class RoutePlanner {
 private route:RouteResult|null=null;private destination='';private pending:Promise<RouteResult>|null=null;private requestedAt=-Infinity;
 constructor(private calculate:typeof calculateOsmRoute=calculateOsmRoute,private now:()=>number=Date.now){}
 async update(from:Coordinates,to:Coordinates,options:Parameters<typeof calculateOsmRoute>[2]={}):Promise<RouteResult>{
  const destination=`${to.latitude},${to.longitude}`;
  if(this.pending)return this.pending;
  const departure=!this.route||destination!==this.destination;
  if(!departure&&(!hasDeviatedFromRoute(from,this.route!.polyline,50)||this.now()-this.requestedAt<10000))return this.route!;
  this.destination=destination;this.requestedAt=this.now();
  this.pending=this.calculate(from,to,{...options,forceRecalculate:true}).then(route=>(this.route=route)).finally(()=>{this.pending=null});
  return this.pending;
 }
}
export function remainingRoute(route:RouteResult,position:Coordinates){
 let best=Infinity,bestIndex=0,bestFraction=0;const cos=Math.cos(position.latitude*Math.PI/180),scale=111320;
 for(let i=0;i<route.polyline.length-1;i++){const a=route.polyline[i],b=route.polyline[i+1],ax=(a[1]-position.longitude)*scale*cos,ay=(a[0]-position.latitude)*scale,dx=(b[1]-a[1])*scale*cos,dy=(b[0]-a[0])*scale;const t=dx*dx+dy*dy?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy))):0;const d=Math.hypot(ax+t*dx,ay+t*dy);if(d<best){best=d;bestIndex=i;bestFraction=t}}
 const segment=(i:number)=>haversineDistanceMeters({latitude:route.polyline[i][0],longitude:route.polyline[i][1]},{latitude:route.polyline[i+1][0],longitude:route.polyline[i+1][1]});
 let total=0,left=0;for(let i=0;i<route.polyline.length-1;i++){const d=segment(i);total+=d;if(i>bestIndex)left+=d;else if(i===bestIndex)left+=d*(1-bestFraction)}
 const ratio=total?Math.max(0,Math.min(1,left/total)):0;return {distanceMeters:Math.round(route.distanceMeters*ratio),durationSeconds:Math.round(route.durationSeconds*ratio)};
}
