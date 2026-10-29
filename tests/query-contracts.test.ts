import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Firestore,FieldPath} from 'firebase-admin/firestore';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,query as webQuery,collection,orderBy,documentId,startAt,endAt,limit,queryEqual} from 'firebase/firestore';
import {queryPlans,validateQueryPlan,type QueryPlan} from '../src/data/queryPlans.ts';
import {adminQuery} from '../server/data/firestoreQueries.ts';
import {clientQuery} from '../src/data/firestoreQueries.ts';

const plans=()=>[
 queryPlans.catalog('products','ش'),queryPlans.catalog('products','شاي'),queryPlans.catalog('catalogProducts','شاي'),queryPlans.catalog('catalogProducts'),
 queryPlans.merchantProducts('store-a'),queryPlans.merchantPayments('store-a'),queryPlans.merchantCustomers('store-a'),
 queryPlans.homeProducts(),queryPlans.homeStores(),queryPlans.carouselProducts(),queryPlans.carouselStores(),
 queryPlans.publicStores(),queryPlans.publicStoreProducts('store-a'),
 queryPlans.portalOrders('store','store-a',['received','preparing'],false),queryPlans.portalOrders('courier','courier-a',['delivered','cancelled'],true),
 queryPlans.customerHistory('customer-a'),queryPlans.adminSettlements(),queryPlans.notifications(),
 queryPlans.audit({field:'status',value:'success'},{from:new Date(0),to:new Date('2026-01-01T00:00:00Z')}),
 ...['actorUid','actorEmail','action','entityType','status','entityId'].map(field=>queryPlans.audit({field,value:'test'})),
];
test('every registered read builds with real server and browser Firestore SDKs without a network call',async()=>{
 const admin=new Firestore({projectId:'demo-query-contracts'});
 const app=initializeApp({projectId:'demo-query-contracts',apiKey:'demo-key'},'query-contracts');const web=getFirestore(app);
 try{
  for(const p of plans()){
   assert.doesNotThrow(()=>adminQuery(admin,p),p.key);
   assert.doesNotThrow(()=>clientQuery(web,p),p.key);
   if(p.orders[0].field==='__name__'){
    assert.doesNotThrow(()=>adminQuery(admin,p,'last-item'),p.key+' cursor');
    assert.doesNotThrow(()=>clientQuery(web,p,'last-item'),p.key+' cursor');
   }
  }
  const p=queryPlans.catalog('products',' شاي ');
  assert(adminQuery(admin,p).isEqual(admin.collection('products').orderBy('name').orderBy(FieldPath.documentId()).startAt('شاي').endAt('شاي\uf8ff').limit(51)));
  assert(queryEqual(clientQuery(web,p),webQuery(collection(web,'products'),orderBy('name'),orderBy(documentId()),startAt('شاي'),endAt('شاي\uf8ff'),limit(51))));
 }finally{await admin.terminate();await deleteApp(app);}
});
test('store and courier scopes stay in query filters and cannot be replaced by a client cursor',()=>{
 for(const p of [queryPlans.merchantProducts('store-a'),queryPlans.merchantPayments('store-a'),queryPlans.portalOrders('store','store-a',['ready'],false)]){
  assert.equal(p.scope,'store');assert.equal(p.filters[0].value,'store-a');
 }
 assert.throws(()=>queryPlans.merchantProducts(''),/scope/);
 assert.throws(()=>queryPlans.merchantPayments('../other-store'),/scope/);
 assert.throws(()=>queryPlans.portalOrders('courier','c',['unknown'],false),/Invalid/);
 assert.throws(()=>queryPlans.audit({field:'privateKey',value:'x'}),/Invalid/);
});
test('read contracts reject unbounded scans and every declared composite index is checked into the repository',()=>{
 const indexes=JSON.parse(readFileSync('firestore.indexes.json','utf8')).indexes;
 for(const p of plans()){
  assert(p.take>0&&p.take<=501,p.key);
  if(p.index)assert(indexes.some((entry:any)=>entry.collectionGroup===p.collection&&JSON.stringify(entry.fields)===JSON.stringify(p.index)),p.key+' is missing its required index');
 }
 const p=queryPlans.publicStores();assert.throws(()=>validateQueryPlan({...p,take:0}));
 assert.throws(()=>validateQueryPlan({...p,take:10000}));
 assert.throws(()=>validateQueryPlan({...p,orders:[]}));
 assert.throws(()=>validateQueryPlan({...queryPlans.merchantProducts('a'),filters:[]}));
});

test('query failures identify their contract without logging search values or private error messages',async t=>{
 const {readQuery}=await import('../server/data/firestoreQueries.ts');
 const log:any[]=[];t.mock.method(console,'error',(...args:any[])=>log.push(args));
 const failure=Object.assign(new Error('private-customer-details'),{code:9});
 const q:any={orderBy:()=>q,startAt:()=>q,endAt:()=>q,limit:()=>q,get:async()=>{throw failure;}};
 await assert.rejects(()=>readQuery({collection:()=>q},queryPlans.catalog('products','private-search-text')),failure);
 const output=JSON.stringify(log);assert(output.includes('catalog.products'));assert(output.includes('9'));
 assert(!output.includes('private-search-text'));assert(!output.includes('private-customer-details'));
});

test('CI guard rejects a newly scattered SDK query while ignoring documentation strings',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const root=await mkdtemp(join(tmpdir(),'sangoub-query-guard-'));
 try{
  for(const folder of ['src','server','api','config'])await mkdir(join(root,folder));
  await writeFile(join(root,'config/query-legacy-baseline.json'),'{}');
  const file=join(root,'server/new-screen.ts');
  await writeFile(file,'// db.collection("products").where("x", "==", 1)\nexport const label="orderBy( createdAt )";');
  const run=()=>spawnSync(process.execPath,[resolve('scripts/check-query-architecture.mjs')],{cwd:root,encoding:'utf8'});
  assert.equal(run().status,0);
  await writeFile(file,'export const read=(db:any)=>db.collection("products").where("inStock","==",true).limit(50);');
  const blocked=run();assert.equal(blocked.status,1);assert.match(blocked.stderr,/new-screen.ts/);
 }finally{await rm(root,{recursive:true,force:true});}
});
