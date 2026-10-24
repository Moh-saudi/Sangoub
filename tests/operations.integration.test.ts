import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { adminServices } from '../server/firebaseAdmin.ts';
import operations from '../api/operations.ts';
import orders from '../api/orders.ts';
import admin from '../api/admin-data.ts';
import delivery from '../api/order-delivery.ts';
process.env.FIREBASE_PROJECT_ID='demo-capital-talabat';process.env.FIREBASE_DATABASE_ID='(default)';process.env.OPERATIONS_V2_READY='true';
const app=initializeApp({apiKey:'demo',projectId:'demo-capital-talabat'},'operations-tests');const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const services=adminServices();const users:Record<string,{uid:string;token:string}>={};
async function call(handler:any,body:any,who='customer'){let status=200,result:any;await handler({method:'POST',headers:{authorization:'Bearer '+users[who].token},body},{setHeader(){},status(value:number){status=value;return this;},json(value:any){result=value;return this;}});return{status,result};}
const payload=()=>({id:'ord-'+randomUUID(),profileName:'عميل التشغيل',phone:'01012345678',ministry:'وزارة النقل',floorNumber:'2',roomNumber:'201',paymentMethod:'cash',tip:0,items:[{product:{id:'ops-meal'},quantity:1,selectedOptions:{}},{product:{id:'ops-water'},quantity:2,selectedOptions:{}}]});
async function create(){const result=await call(orders,payload());assert.equal(result.status,200,JSON.stringify(result.result));return result.result.order;}
async function prepare(id:string,who:string){assert.equal((await call(operations,{action:'prepare',orderId:id,next:'preparing'},who)).status,200);const storeId=who==='chef'?'ops-kitchen':'ops-market';const ticket=(await services.db.doc(`orders/${id}/fulfillments/${storeId}`).get()).data()!;const ids=ticket.items.map((item:any)=>item.id);assert.equal((await call(operations,{action:'prepare',orderId:id,next:'ready',checkedItemIds:ids},who)).status,200);}
before(async()=>{
 for(const role of ['admin','chef','picker','courier','other-courier','customer']){const user=await services.auth.createUser({email:`${role}-ops@example.com`,emailVerified:true,password:'TestPassword123!'});const token=await(await signInWithEmailAndPassword(auth,user.email!,'TestPassword123!')).user.getIdToken();users[role]={uid:user.uid,token};await services.db.doc('users/'+user.uid).set({uid:user.uid,fullName:role,email:user.email,phone:'01012345678',role:'employee',walletBalance:0});}
 await services.db.doc('admins/'+users.admin.uid).set({active:true});
 for(const [role,storeId]of [['chef','ops-kitchen'],['picker','ops-market']])await services.db.doc('staff/'+users[role].uid).set({role:'restaurant',storeId,name:role,phone:'01012345678'});
 for(const role of ['courier','other-courier'])await services.db.doc('staff/'+users[role].uid).set({role:'courier',name:role,phone:'01012345678'});
 await services.db.doc('stores/ops-kitchen').set({name:'مطعم التشغيل',category:'sandwiches',status:'open',deliveryFee:10,minOrder:0,locationInDistrict:'نقطة المطعم'});
 await services.db.doc('stores/ops-market').set({name:'سوبر ماركت التشغيل',category:'supermarket',status:'open',deliveryFee:5,minOrder:0,locationInDistrict:'نقطة السوبر ماركت'});
 for(const [id,storeId,name,price]of [['ops-meal','ops-kitchen','وجبة اختبار',50],['ops-water','ops-market','مياه اختبار',10]])await services.db.doc('products/'+id).set({id,storeId,name,price,inStock:true,category:'وجبات خفيفة',description:'اختبار'});
 await services.db.doc('appConfig/operations').set({enabled:true});
});
after(async()=>{await deleteApp(app);});
test('profile comes from trusted assignments and a store sees only its own ticket',async()=>{
 const order=await create();assert.equal(order.fulfillmentVersion,2);assert.equal((await services.db.collection(`orders/${order.id}/fulfillments`).get()).size,2);
 const profile=await call(operations,{action:'profile'},'picker');assert.equal(profile.result.destination,'store_preparation');assert.equal(profile.result.store.preparationType,'picking');
 const list=await call(operations,{action:'list',storeId:'ops-market'},'chef');assert.equal(list.status,200);const ticket=list.result.items.find((item:any)=>item.orderId===order.id);assert.equal(ticket.items.length,1);assert.equal(ticket.items[0].product.id,'ops-meal');assert.equal(ticket.phone,undefined);assert.equal(ticket.ministry,undefined);assert.equal(JSON.stringify(ticket).includes('مياه اختبار'),false);
 assert.equal((await call(operations,{action:'inspect',orderId:order.id},'chef')).status,403);
 assert.equal((await call(operations,{action:'prepare',orderId:order.id,storeId:'ops-market',next:'preparing'},'chef')).status,403);
});
test('mixed order requires preparation, item review, each pickup and departure before delivery',async()=>{
 const order=await create();
 assert.equal((await call(operations,{action:'prepare',orderId:order.id,next:'ready'},'chef')).status,409);
 assert.equal((await call(operations,{action:'prepare',orderId:order.id,next:'preparing'},'chef')).status,200);
 assert.equal((await call(operations,{action:'prepare',orderId:order.id,next:'ready',checkedItemIds:[]},'chef')).status,400);
 await prepare(order.id,'chef');assert.equal((await services.db.doc('orders/'+order.id).get()).data()?.orderStatus,'preparing');
 await prepare(order.id,'picker');assert.equal((await services.db.doc('orders/'+order.id).get()).data()?.orderStatus,'ready');
 const assigned=await call(admin,{action:'save',collection:'orders',id:order.id,data:{courierId:users.courier.uid,orderStatus:'with_courier'}},'admin');assert.equal(assigned.status,200,JSON.stringify(assigned.result));assert.equal((await services.db.doc('orders/'+order.id).get()).data()?.orderStatus,'ready');
 const list=await call(operations,{action:'list'},'courier');const task=list.result.items.find((item:any)=>item.id===order.id);assert.equal(task.stops.length,2);assert.equal(task.amountToCollect,85);
 assert.equal((await call(operations,{action:'depart',orderId:order.id},'courier')).status,409);
 assert.equal((await call(operations,{action:'pickup',orderId:order.id,storeId:'ops-kitchen',confirmed:true},'other-courier')).status,403);
 for(const storeId of ['ops-kitchen','ops-market'])assert.equal((await call(operations,{action:'pickup',orderId:order.id,storeId,confirmed:true},'courier')).status,200);
 assert.equal((await call(operations,{action:'pickup',orderId:order.id,storeId:'ops-kitchen',confirmed:true},'courier')).status,200);
 assert.equal((await services.db.doc('orders/'+order.id).get()).data()?.pickedUpStoreIds.length,2);
 assert.equal((await call(operations,{action:'depart',orderId:order.id},'courier')).status,200);
 const code=await call(delivery,{action:'code',orderId:order.id});assert.equal(code.status,200);
 const done=await call(delivery,{action:'deliver',orderId:order.id,otpCode:code.result.otpCode,collectedAmount:85},'courier');assert.equal(done.status,200,JSON.stringify(done.result));
 assert.equal((await services.db.doc('orders/'+order.id).get()).data()?.orderStatus,'delivered');assert.equal((await services.db.doc(`courierAssignments/${users.courier.uid}/orders/${order.id}`).get()).data()?.active,false);
});
test('issues require administrative resolution and cancellations close every ticket atomically',async()=>{
 const order=await create();const report=await call(operations,{action:'report-issue',orderId:order.id,reason:'صنف ناقص ويحتاج مراجعة'},'chef');assert.equal(report.status,200);
 assert.equal((await call(operations,{action:'prepare',orderId:order.id,next:'preparing'},'chef')).status,409);
 assert.equal((await call(operations,{action:'resolve-issue',orderId:order.id,storeId:'ops-kitchen',reason:'تمت المراجعة دون استبدال'},'chef')).status,403);
 assert.equal((await call(operations,{action:'resolve-issue',orderId:order.id,storeId:'ops-kitchen',reason:'تمت المراجعة دون استبدال'},'admin')).status,200);
 const cancel=await call(operations,{action:'cancel',orderId:order.id});assert.equal(cancel.status,200);
 assert((await services.db.collection(`orders/${order.id}/fulfillments`).get()).docs.every(doc=>doc.data().status==='cancelled'));
 assert.equal((await services.db.doc(`stores/ops-market/preparationQueue/${order.id}`).get()).data()?.active,false);
});
test('staged rollout preserves old orders and online payment stays pending',async()=>{
 const online=await call(orders,{...payload(),paymentMethod:'geidea'});assert.equal(online.status,200);assert.equal(online.result.order.paymentStatus,'pending');
 assert.equal((await call(operations,{action:'prepare',orderId:online.result.order.id,next:'preparing'},'chef')).status,409);
 process.env.OPERATIONS_V2_READY='false';const legacy=await create();assert.equal(legacy.fulfillmentVersion,undefined);process.env.OPERATIONS_V2_READY='true';
});

test('self-asserted roles and revoked accounts cannot use operational endpoints',async()=>{
 await services.db.doc('users/'+users.customer.uid).update({role:'admin'});
 const profile=await call(operations,{action:'profile',role:'admin'});assert.equal(profile.result.role,'employee');
 assert.equal((await call(operations,{action:'list'})).status,403);
 await services.db.doc('accountAccess/'+users.chef.uid).set({disabled:true});
 assert.equal((await call(operations,{action:'profile'},'chef')).status,403);
 await services.db.doc('accountAccess/'+users.chef.uid).delete();
});
