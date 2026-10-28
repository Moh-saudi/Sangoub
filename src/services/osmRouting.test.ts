import test from 'node:test';import assert from 'node:assert/strict';
import {haversineDistanceMeters,estimateFallbackRoute,hasDeviatedFromRoute,calculateOsmRoute,OSM_CONFIG} from './osmRouting.ts';
const from={latitude:30.0165,longitude:31.742},to={latitude:30.038,longitude:31.715};
test('Haversine and estimated fallback are explicit estimates',()=>{const distance=haversineDistanceMeters(from,to);assert(distance>3000&&distance<3800);const fallback=estimateFallbackRoute(from,to);assert.equal(fallback.isFallback,true);assert.equal(fallback.distanceMeters,Math.round(distance*1.3));assert(fallback.durationSeconds>=60);assert(OSM_CONFIG.attribution.includes('OpenStreetMap'));});
test('deviation measures segments: midpoint of sparse route is not a 700m false deviation',()=>{assert.equal(hasDeviatedFromRoute({latitude:30.005,longitude:31.705},[[30,31.7],[30.01,31.71]],50),false);assert.equal(hasDeviatedFromRoute({latitude:30.02,longitude:31.72},[[30,31.7],[30.01,31.71]],50),true);});
test('route uses authenticated same-origin proxy and cache; no provider receives token',async()=>{let calls=0;const options={forceRecalculate:true,getToken:async()=>'mock-token',fetch:async(url:any,init:any)=>{calls++;assert.equal(url,'/api/osm/route');assert.equal(init.headers.Authorization,'Bearer mock-token');return new Response(JSON.stringify({distanceMeters:4400,durationSeconds:480,polyline:[[from.latitude,from.longitude],[to.latitude,to.longitude]]}))}};const route=await calculateOsmRoute(from,to,options);assert.equal(route.isFallback,false);await calculateOsmRoute(from,to,{...options,forceRecalculate:false});assert.equal(calls,1);});
test('real AbortController timeout is deterministic with a fake clock and stalled fake fetch',async t=>{t.mock.timers.enable({apis:['setTimeout']});let aborted=false;const pending=calculateOsmRoute(from,to,{forceRecalculate:true,timeoutMs:4000,getToken:async()=>'mock',fetch:async(_,init)=>new Promise((_,reject)=>init!.signal!.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'))}))});await Promise.resolve();await Promise.resolve();t.mock.timers.tick(4000);const route=await pending;assert(aborted);assert(route.isFallback);t.mock.timers.reset();});
test('network errors and malformed responses fall back without any Firebase initialization',async()=>{const result=await calculateOsmRoute(from,to,{forceRecalculate:true,getToken:async()=>'mock',fetch:async()=>{throw Error('offline')}});assert(result.isFallback);const malformed=await calculateOsmRoute(from,to,{forceRecalculate:true,getToken:async()=>'mock',fetch:async()=>new Response('{}')});assert(malformed.isFallback);});

test('planner recalculates on departure and >50m deviation only; ETA decreases without new requests',async()=>{
 const {RoutePlanner,remainingRoute}=await import('./osmRouting.ts');let calls=0,time=0;
 const route={distanceMeters:2000,durationSeconds:240,polyline:[[30,31.7],[30.01,31.71]] as [number,number][],isFallback:false,calculatedAt:0};
 const planner=new RoutePlanner(async()=>{calls++;return route},()=>time);
 await planner.update({latitude:30,longitude:31.7},{latitude:30.01,longitude:31.71});time=20000;
 await planner.update({latitude:30.005,longitude:31.705},{latitude:30.01,longitude:31.71});assert.equal(calls,1);
 const remaining=remainingRoute(route,{latitude:30.005,longitude:31.705});assert(Math.abs(remaining.durationSeconds-120)<2);
 await planner.update({latitude:30.03,longitude:31.72},{latitude:30.01,longitude:31.71});assert.equal(calls,2);
});
