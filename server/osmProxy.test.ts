import test from 'node:test';import assert from 'node:assert/strict';import { createOsmService,createOsmHandler,type OsmConfig } from './osmProxy.ts';
const config:OsmConfig={bbox:[31.5,29.85,31.95,30.2],routeUrl:'https://route.example/route/v1/driving',searchUrl:'https://search.example',userAgent:'Sangoub-tests/contact-not-sent'};
const from={latitude:30.01,longitude:31.7},to={latitude:30.03,longitude:31.75};
const route={routes:[{distance:5000,duration:600,geometry:{coordinates:[[31.7,30.01],[31.75,30.03]]}}]};
test('route input is numeric, bbox-scoped and not an open proxy; rounding cache avoids upstream duplicates',async()=>{let calls=0;const service=createOsmService(config,{fetch:async(url,init)=>{calls++;assert(String(url).startsWith(config.routeUrl));assert.equal((init?.headers as any)['User-Agent'],config.userAgent);return new Response(JSON.stringify(route))}});for(const input of [{from:{latitude:'30',longitude:31.7},to},{from:{latitude:0,longitude:0},to},{from,to,url:'https://evil.example'}])await assert.rejects(service('route',input,'u'),(e:any)=>e.status===400);const r=await service('route',{from,to},'u');assert.deepEqual(r.polyline,[[30.01,31.7],[30.03,31.75]]);await service('route',{from:{...from,latitude:30.010001},to},'u');assert.equal(calls,1);});
test('per-user budgets and global Nominatim one-per-second cap include concurrent calls',async()=>{let time=0,calls=0;const service=createOsmService(config,{now:()=>time,fetch:async()=>{calls++;return new Response(JSON.stringify([{place_id:1,lat:'30.01',lon:'31.7',display_name:'موقع'}]))}});await service('search',{query:'منطقة أولى'},'u1');await assert.rejects(service('search',{query:'منطقة ثانية'},'u2'),(e:any)=>e.status===429);time=1000;await service('search',{coordinates:from},'u2');assert.equal(calls,2);for(let i=0;i<29;i++)await service('search',{query:'منطقة أولى'},'u1');await assert.rejects(service('search',{query:'منطقة أولى'},'u1'),(e:any)=>e.status===429);});
test('upstream timeout aborts at four seconds without network (fake timer, real AbortController)',async t=>{t.mock.timers.enable({apis:['setTimeout']});let aborted=false;const service=createOsmService(config,{fetch:async(_,init)=>new Promise((_,reject)=>init!.signal!.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'))}))});const result=assert.rejects(service('route',{from,to},'u'),(e:any)=>e.status===504);t.mock.timers.tick(4000);await result;assert(aborted);t.mock.timers.reset();});
test('handler verifies identity before lookup, hides diagnostics and rejects missing or invalid tokens',async()=>{let calls=0;const handler=createOsmHandler({identify:async token=>{if(token!=='valid')throw Error('private');return 'verified-user'},lookup:async(_,__,uid)=>{calls++;assert.equal(uid,'verified-user');return {results:[]}}});for(const [token,expected]of [[null,401],['invalid',401],['valid',200]]as const){let status=0,body:any;await handler({method:'POST',headers:token?{authorization:'Bearer '+token}:{},query:{action:'search'},body:{query:'مكان'}},{setHeader(){},status(n:number){status=n;return this},json(v:any){body=v}});assert.equal(status,expected);assert(!JSON.stringify(body).includes('private'));}assert.equal(calls,1);});
test('malformed upstream response fails closed and search text is bounded',async()=>{const service=createOsmService(config,{fetch:async()=>new Response(JSON.stringify({routes:[{distance:-1}]}))});await assert.rejects(service('route',{from,to},'u'),(e:any)=>e.status===502);await assert.rejects(service('search',{query:'x'.repeat(121)},'u'),(e:any)=>e.status===400);await assert.rejects(service('search',{query:'مكان',coordinates:from},'u'),(e:any)=>e.status===400);});

test('search and reverse lookup request structured address details and retain delivery fields', async () => {
 let time=0;
 const service=createOsmService(config,{now:()=>time,fetch:async url=>{
  assert.equal(new URL(String(url)).searchParams.get('addressdetails'),'1');
  const place={lat:'30.01',lon:'31.7',display_name:'عنوان',address:{road:'شارع النخيل',city_district:'زهرة العاصمة',quarter:'الحي الأول',office:'مكتب ٥',pedestrian:'ممشى',unknown:'discard'}};
  return new Response(JSON.stringify(String(url).includes('/reverse?')?place:[place]));
 }});
 for(const input of [{query:'شارع النخيل'},{coordinates:from}]){
  const result=await service('search',input,'user');
  assert.equal(result.results[0].address.city_district,'زهرة العاصمة');
  assert.equal(result.results[0].address.office,'مكتب ٥');
  assert.equal(result.results[0].address.unknown,undefined);
  time+=1000;
 }
});

test('unverified account receives the verification error instead of an invalid-session error', async () => {
 const {OsmError}=await import('./osmProxy.ts');
 const handler=createOsmHandler({identify:async()=>{throw new OsmError(403,'أكد حسابك لاستخدام الخرائط.');},lookup:async()=>{throw Error('must not run');}});
 let status=0,body:any;
 await handler({method:'POST',headers:{authorization:'Bearer unverified'},query:{action:'search'},body:{}},{setHeader(){},status(code:number){status=code;return this},json(value:any){body=value}});
 assert.equal(status,403);assert.match(body.error,/أكد حسابك/);
});

test('guest search resolves addresses without identity while route and other actions require a token', async () => {
 let lookups=0;
 const handler=createOsmHandler({guestSearchKey:()=> 'guest:hashed-ip',identify:async()=>{throw Error('guest must not authenticate');},lookup:async(kind,input,uid)=>{lookups++;assert.equal(kind,'search');assert.equal(uid,'guest:hashed-ip');return {results:[{display_name:'شارع النخيل'}]};}});
 for (const [action,status] of [['search',200],['route',401],['other',401]] as const){
  let code=0;
  await handler({method:'POST',headers:{},query:{action},body:{query:'شارع النخيل'}},{setHeader(){},status(n:number){code=n;return this},json(){}});
  assert.equal(code,status);
 }
 assert.equal(lookups,1);
});
