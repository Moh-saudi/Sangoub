import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Timestamp,GeoPoint} from 'firebase-admin/firestore';
import {PGlite} from '@electric-sql/pglite';
import {checksum,encode,verifyExport,stagingSql} from '../scripts/migration/format.mjs';
const fixture=()=>{
 const data={name:"شاي ' ; drop table public.stores; -- \\",ts:new Timestamp(1720000000,123456789),
  bytes:Buffer.from([0,255]),point:new GeoPoint(30,31),nan:NaN,inf:Infinity,items:[null,true,12],
  userMetadata:{__type:'timestamp',seconds:42}};
 const contents=JSON.stringify({path:'stores/s1/preparationQueue/o1',data:encode(data)})+'\n';
 return {contents,manifest:{version:1,consistency:'writes-paused',projectId:'test',databaseId:'(default)',
  exportedAt:'2026-10-29T00:00:00Z',documentCount:1,sha256:checksum(contents)}};
};
test('export preserves Firestore precision, bytes, special numbers and user metadata',()=>{
 const {contents,manifest}=fixture(), row=verifyExport(contents,manifest)[0];
 const values=Object.fromEntries(row.data[1]);
 assert.deepEqual(values.ts,['timestamp',1720000000,123456789]);
 assert.deepEqual(values.bytes,['bytes','AP8=']);
 assert.deepEqual(values.nan,['number','NaN']);assert.deepEqual(values.inf,['number','Infinity']);
 assert.deepEqual(values.point,['geopoint',30,31]);
 assert.deepEqual(values.userMetadata,['map',[['__type',['string','timestamp']],['seconds',['number',42]]]]);
 assert.throws(()=>encode(undefined),/Unsupported/);
});
test('import refuses corrupt, partial, duplicate or unpaused exports',()=>{
 const {contents,manifest}=fixture();
 assert.throws(()=>verifyExport(contents+' ',manifest),/checksum/);
 assert.throws(()=>verifyExport(contents,{...manifest,documentCount:2}),/count/);
 assert.throws(()=>verifyExport(contents,{...manifest,consistency:'live'}),/paused/);
 const twice=contents+contents;
 assert.throws(()=>verifyExport(twice,{...manifest,sha256:checksum(twice),documentCount:2}),/Duplicate/);
});
test('PostgreSQL schema enforces catalog identities, tenant offers and default-deny access',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec(await readFile(new URL('../supabase/migrations/202610290001_migration_foundation.sql',import.meta.url),'utf8'));
 await db.exec(`insert into stores(id,name,status) values ('s1','متجر أ','open'),('s2','متجر ب','closed');
 insert into categories(id,name_ar) values ('c','مشروبات');
 insert into catalog_products(id,category_id,name_ar) values ('p','c','شاي'),('p2','c','قهوة');
 insert into catalog_variants(id,product_id,sku,barcode,name_ar) values ('v','p','tea250','123','250 جم');
 insert into merchant_offers(id,store_id,variant_id,price_minor) values ('o1','s1','v',6500),('o2','s2','v',6800);`);
 assert.equal((await db.query('select count(*)::integer as n from merchant_offers')).rows[0].n,2);
 await assert.rejects(db.exec("insert into merchant_offers(id,store_id,variant_id,price_minor) values ('dup','s1','v',6000)"),/unique/i);
 await assert.rejects(db.exec("insert into catalog_variants(id,product_id,sku,barcode,name_ar) values ('v2','p','tea500','123','500 جم')"),/unique/i);
 await assert.rejects(db.exec("insert into merchant_offers(id,store_id,variant_id,price_minor) values ('bad','missing','v',6000)"),/foreign key/i);
 await assert.rejects(db.exec("insert into catalog_images(id,product_id,variant_id,url) values ('img','p2','v','https://example.test/a.jpg')"),/foreign key/i);
 await assert.rejects(db.exec("update merchant_offers set price_minor=-1 where id='o1'"),/check constraint/i);
 await db.exec('set role anon');
 await assert.rejects(db.exec('select * from public.merchant_offers'),/permission denied/i);
 await assert.rejects(db.exec('select * from migration_private.documents'),/permission denied/i);
 await db.exec('reset role; set role authenticated');
 await assert.rejects(db.exec('select * from public.profiles'),/permission denied/i);
 await db.exec('reset role');
 const rls=await db.query("select count(*)::integer as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity");
 assert.equal(rls.rows[0].n,10);
 }finally{await db.close();}
});
test('staging import runs atomically, safely quotes Arabic content, and can be replayed',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec(await readFile(new URL('../supabase/migrations/202610290001_migration_foundation.sql',import.meta.url),'utf8'));
 const {contents,manifest}=fixture(), sql=stagingSql(contents,manifest);
 await db.exec(sql);await db.exec(sql);
 const result=await db.query('select path,data from migration_private.documents');
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].path,'stores/s1/preparationQueue/o1');
 assert.deepEqual(result.rows[0].data.encoded,JSON.parse(contents).data);
 assert.equal((await db.query('select count(*)::integer as n from public.stores')).rows[0].n,0);
 }finally{await db.close();}
});
test('export traversal includes subcollections below missing parents and chunks reads',async()=>{
 const {walkFirestore}=await import('../scripts/migration/walk-firestore.mjs');
 const paths=[],batches=[];
 const child={listDocuments:async()=>[{path:'root/missing/children/live',listCollections:async()=>[]}]};
 const refs=Array.from({length:105},(_,i)=>({path:'root/'+i,listCollections:async()=>[]}));
 refs.push({path:'root/missing',listCollections:async()=>[child]});
 const db={listCollections:async()=>[{listDocuments:async()=>refs}],getAll:async(...batch)=>{
  batches.push(batch.length);return batch.map(ref=>({ref,exists:ref.path!=='root/missing'}));
 }};
 await walkFirestore(db,snapshot=>paths.push(snapshot.ref.path));
 assert.equal(paths.length,106);assert.ok(paths.includes('root/missing/children/live'));
 assert.ok(!paths.includes('root/missing'));assert.ok(Math.max(...batches)<=100);
});
