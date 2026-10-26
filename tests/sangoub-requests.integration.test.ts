import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {adminServices} from '../server/firebaseAdmin.ts';
import orders from '../api/orders.ts';
import admin from '../api/admin-data.ts';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Demo emulators required');
process.env.FIREBASE_PROJECT_ID='demo-capital-talabat';process.env.FIREBASE_DATABASE_ID='(default)';
const services=adminServices(),app=initializeApp({apiKey:'demo',projectId:'demo-capital-talabat'},'intake-test'),auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});let token='';
const draft={quantities:{foul:2},name:'عميل اختبار',phone:'01012345678',address:'وزارة اختبار',office:'الدور 2',notes:'بدون شطة',payment:'instapay'};
async function call(handler:any,body:any,bearer='',origin='http://localhost:3105') {let status=200,result:any;await handler({method:'POST',body,headers:{origin,host:'localhost:3105','content-type':'application/json',...(bearer?{authorization:'Bearer '+bearer}:{})}},{setHeader(){},status(value:number){status=value;return this;},json(value:any){result=value;return this;}});return {status,result};}
before(async()=>{const user=await services.auth.createUser({email:'intake-admin@example.com',emailVerified:true,password:'TestPassword123!'});await services.db.doc('admins/'+user.uid).set({enabled:true});token=await(await signInWithEmailAndPassword(auth,user.email!,'TestPassword123!')).user.getIdToken();});
after(async()=>{await deleteApp(app);});
test('anonymous intake validates contact, catalog choices, strict fields and same origin without opening authenticated order writes',async()=>{
 assert.equal((await call(orders,{action:'sangoub-request',id:randomUUID(),kind:'breakfast',draft},'','https://evil.example')).status,403);
 for(const patch of [{phone:''},{phone:'123'},{quantities:{unknown:1}},{quantities:{foul:1.5}},{name:''},{payment:'paid'},{price:1}])assert.equal((await call(orders,{action:'sangoub-request',id:randomUUID(),kind:'breakfast',draft:{...draft,...patch}})).status,400);
 assert.equal((await call(orders,{id:'ord-'+randomUUID(),items:[]})).status,401);
 assert.equal((await call(admin,{action:'sangoub-list'})).status,401);
});
test('intake saves once under concurrent retries, ignores no fields, preserves original data and never marks payment or creates operational orders',async()=>{
 const body={action:'sangoub-request',id:randomUUID(),kind:'breakfast',draft};
 const results=await Promise.all(Array.from({length:4},()=>call(orders,body)));
 assert.ok(results.every(result=>result.status===200));assert.equal(new Set(results.map(result=>result.result.id)).size,1);
 const id=results[0].result.id, saved=(await services.db.doc('sangoubRequests/'+id).get()).data()!;
 assert.equal(saved.status,'new');assert.equal(saved.payment,'instapay');assert.equal(saved.paymentStatus,undefined);assert.equal(saved.total,undefined);assert.equal(saved.items[0].name,'ساندوتش فول');assert.equal(saved.items[0].quantity,2);
 assert.equal((await services.db.collection('orders').get()).size,0);
 assert.equal((await call(orders,{...body,draft:{...draft,name:'اسم متغير'}})).status,409);
 const listed=await call(admin,{action:'sangoub-list'},token);assert.equal(listed.status,200);assert.equal(listed.result.requests[0].fingerprint,undefined);
 assert.equal((await call(admin,{action:'sangoub-update',id,status:'contacted',expectedStatus:'new',expectedVersion:1,note:'تأكيد التوفر والسعر'},token)).status,200);
 assert.equal((await call(admin,{action:'sangoub-update',id,status:'completed',expectedStatus:'new',expectedVersion:1,note:'طلب متزامن قديم'},token)).status,409);
 assert.ok((await services.db.collection('auditLogs').where('entityId','==',id).get()).size===1);
});
test('supermarket canonical units and per-phone daily limit are enforced',async()=>{
 const grocery={...draft,phone:'01112345678',quantities:{'coffee-plain':1,'water-small':2}};
 for(let i=0;i<10;i++)assert.equal((await call(orders,{action:'sangoub-request',id:randomUUID(),kind:'supermarket',draft:grocery})).status,200);
 assert.equal((await call(orders,{action:'sangoub-request',id:randomUUID(),kind:'supermarket',draft:grocery})).status,429);
 const list=(await call(admin,{action:'sangoub-list'},token)).result.requests;assert.ok(list.some((item:any)=>item.items.some((line:any)=>line.name.includes('125 جم'))));
});
