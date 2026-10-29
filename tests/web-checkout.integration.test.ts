import {getFirestore,connectFirestoreEmulator,doc,updateDoc,setDoc,serverTimestamp,getDocs,collection,query,where} from 'firebase/firestore';
import adminHandler from '../api/admin-data.ts';
import operationsHandler from '../api/operations.ts';
import deliveryHandler from '../api/order-delivery.ts';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {adminServices} from '../server/firebaseAdmin.ts';
import handler from '../api/orders.ts';
import callback from '../api/geidea/callback.ts';
import {ensureOrderPayment} from '../server/orderPayments.ts';
import {ASIMA_CONFIG,GeideaGateway} from '../server/integrations.ts';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Demo emulators required');
process.env.FIREBASE_PROJECT_ID='demo-capital-talabat';process.env.FIREBASE_DATABASE_ID='(default)';
const services=adminServices(),app=initializeApp({apiKey:'demo',projectId:'demo-capital-talabat'},'web-checkout');const clientDb=getFirestore(app);connectFirestoreEmulator(clientDb,'127.0.0.1',8080);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});let uid='',token='';
async function call(body:any,bearer=token,endpoint:any=handler){let status=200,result:any;await endpoint({method:'POST',headers:{authorization:'Bearer '+bearer},body},{setHeader(){},status(v:number){status=v;return this;},json(v:any){result=v;return this;}});return {status,result};}
const payload=()=>({id:'ord-'+randomUUID(),profileName:'عميل اختبار الويب',phone:'01012345678',ministry:'وزارة اختبار',floorNumber:'2',roomNumber:'12',paymentMethod:'cash',tip:0,items:[{product:{id:'web-product'},quantity:2,selectedOptions:{الحجم:'كبير'}}]});
before(async()=>{const user=await services.auth.createUser({email:'web-checkout@example.com',password:'TestPassword123!',emailVerified:true});uid=user.uid;token=await(await signInWithEmailAndPassword(auth,user.email!,'TestPassword123!')).user.getIdToken();await services.db.doc('users/'+uid).set({uid,fullName:'عميل اختبار'});await services.db.doc('stores/web-store').set({id:'web-store',name:'متجر الويب',status:'open',deliveryFee:15,minOrder:20});await services.db.doc('products/web-product').set({id:'web-product',storeId:'web-store',storeName:'متجر الويب',name:'منتج اختبار',description:'اختبار',category:'test',price:20,inStock:true,optionGroups:[{id:'size',title:'الحجم',required:true,options:[{name:'كبير',price:5}]}]});});
after(async()=>{await deleteApp(app);});
test('quote is server-priced, read-only, and detects price changes before order creation',async()=>{const input=payload();let quote=await call({...input,action:'quote',total:0});assert.equal(quote.status,200);assert.equal(quote.result.quote.total,65);assert.equal((await services.db.collection('orders').get()).size,0);assert.equal((await services.db.collection('orderSecrets').get()).size,0);
 await services.db.doc('products/web-product').update({price:21});assert.equal((await call({...input,quoteHash:quote.result.quoteHash})).status,409);assert.equal((await services.db.collection('orders').get()).size,0);
 quote=await call({...input,action:'quote'});const created=await call({...input,quoteHash:quote.result.quoteHash,total:0});assert.equal(created.status,200);assert.equal(created.result.order.total,67);assert.equal(created.result.order.paymentStatus,'cash_on_delivery');assert.equal((await call({...input,quoteHash:quote.result.quoteHash})).result.order.id,created.result.order.id);assert.equal((await services.db.collection('orders').get()).size,1);
 assert.equal((await call({action:'order-status',orderId:created.result.order.id})).status,200);assert.equal((await call({action:'order-status',orderId:'someone-elses-order'})).status,404);assert.equal((await call({action:'customer-orders'})).result.orders.length,1);assert.equal((await call({...input,action:'quote'},'')).status,401);
 // Use the same scoped operational API as the current merchant/courier portals; raw merchant orders stay private.
 const role=async(name:string,assignment:any)=>{const user=await services.auth.createUser({email:name+'@example.com',password:'TestPassword123!',emailVerified:true});if(assignment.role==='admin')await services.db.doc('admins/'+user.uid).set({enabled:true});else await services.db.doc('staff/'+user.uid).set(assignment);return {uid:user.uid,token:await(await signInWithEmailAndPassword(auth,user.email!,'TestPassword123!')).user.getIdToken()};};
 const chef=await role('web-chef',{role:'restaurant',name:'شيف اختبار',phone:'01012345678',storeId:'web-store'});
 await assert.rejects(getDocs(query(collection(clientDb,'orders'),where('storeIds','array-contains','web-store'))), (error:any)=>error.code==='permission-denied');
 const feed=await call({action:'portal-active'},chef.token,operationsHandler);assert.equal(feed.status,200);assert.equal(feed.result.items.length,1);assert.equal(feed.result.items[0].profileId,undefined);assert.equal(feed.result.items[0].coordinates,undefined);
 assert.equal((await call({action:'legacy-prepare',id:created.result.order.id,next:'preparing'},chef.token,operationsHandler)).status,200);
 assert.equal((await call({action:'order-status',orderId:created.result.order.id})).result.order.orderStatus,'preparing');
 assert.equal((await call({action:'legacy-prepare',id:created.result.order.id,next:'ready'},chef.token,operationsHandler)).status,200);
 const courier=await role('web-courier',{role:'courier',name:'مندوب اختبار',phone:'01112345678'});const admin=await role('web-admin',{role:'admin'});
 assert.equal((await call({action:'save',collection:'orders',id:created.result.order.id,data:{courierId:courier.uid}},admin.token,adminHandler)).status,200);
 assert.equal((await services.db.doc('orders/'+created.result.order.id).get()).data()?.orderStatus,'ready','assignment is not physical pickup');
 await signInWithEmailAndPassword(auth,'web-courier@example.com','TestPassword123!');assert.equal((await getDocs(query(collection(clientDb,'orders'),where('courierId','==',courier.uid)))).size,1);
 assert.equal((await call({action:'courier-depart',orderId:created.result.order.id},courier.token,operationsHandler)).status,409);
 assert.equal((await call({action:'courier-pickup',orderId:created.result.order.id,confirmed:true},courier.token,operationsHandler)).status,200);
 assert.equal((await call({action:'courier-depart',orderId:created.result.order.id},courier.token,operationsHandler)).status,200);
 await setDoc(doc(clientDb,'tracking',created.result.order.id),{coordinates:{latitude:30.01,longitude:31.73},active:true,updatedAt:serverTimestamp()});
 assert.equal((await call({action:'order-status',orderId:created.result.order.id})).result.tracking.coordinates.latitude,30.01);
 const secret=await call({action:'code',orderId:created.result.order.id},token,deliveryHandler);assert.equal(secret.status,200);
 assert.equal((await call({action:'deliver',orderId:created.result.order.id,otpCode:secret.result.otpCode,collectedAmount:67},courier.token,deliveryHandler)).status,200);
 assert.equal((await call({action:'order-status',orderId:created.result.order.id})).result.order.orderStatus,'delivered');

});
test('payment sessions are created once, callbacks require provider verification, and amount/reference/status mismatches never mark paid',async()=>{
 const originalFetch=globalThis.fetch,config=ASIMA_CONFIG.geidea,oldEnvironment=config.environment,oldTest={...config.test};config.environment='test';Object.assign(config.test,{merchantPublicKey:'test-key',apiPassword:'test-only',baseUrl:'https://provider.invalid'});
 let creations=0,reference='',paid=false,amount=123;const id='payment-web-order';
 globalThis.fetch=async(input,init)=>{const url=String(input);if(!url.startsWith('https://provider.invalid'))return originalFetch(input,init);if(url.includes('/session')){creations++;reference=JSON.parse(String(init?.body)).merchantReferenceId;await new Promise(resolve=>setTimeout(resolve,30));return new Response(JSON.stringify({responseCode:'000',session:{id:'test-session'},order:{orderId:'provider-order-1'}}),{status:200});}return new Response(JSON.stringify({order:{orderId:'provider-order-1',status:paid?'Success':'Pending',merchantReferenceId:reference,amount,currency:'EGP',paymentMethod:'MeezaMobileWallet'}}),{status:200});};
 try{
  await services.db.doc('orders/'+id).set({profileId:uid,profileName:'عميل اختبار',total:123,paymentMethod:'geidea',paymentStatus:'pending',orderStatus:'received',storeIds:[],pendingStoreIds:['web-store']});
  const results=await Promise.all([ensureOrderPayment(services.db,id,'test@example.com',uid),ensureOrderPayment(services.db,id,'test@example.com',uid)]);assert.equal(creations,1);assert.ok(results.some(result=>result.sessionId==='test-session'));assert.equal((await ensureOrderPayment(services.db,id,'test@example.com',uid)).sessionId,'test-session');assert.equal(creations,1);await assert.rejects(ensureOrderPayment(services.db,id,'test@example.com','other-user'));
  const notification={orderId:'provider-order-1',status:'PAID',responseCode:'000',metadata:{orderId:id},amount:123};
  assert.equal((await call(notification,'',callback)).status,409);assert.equal((await services.db.doc('orders/'+id).get()).data()?.paymentStatus,'pending');paid=true;amount=124;assert.equal((await call(notification,'',callback)).status,409);amount=123;
  assert.equal((await call(notification,'',callback)).status,200);assert.equal((await call(notification,'',callback)).status,200);assert.equal((await call({orderId:'provider-order-1'},'',callback)).status,200);assert.equal((await services.db.doc('orders/'+id).get()).data()?.paymentStatus,'paid');assert.equal((await services.db.collection('geideaTransactions').get()).size,1);assert.deepEqual((await services.db.doc('orders/'+id).get()).data()?.storeIds,['web-store']);
  await assert.rejects(GeideaGateway.verifyOrderPayment('provider-order-1',{referenceId:'wrong-reference',amount:123,currency:'EGP'}));
  await assert.rejects(GeideaGateway.verifyOrderPayment('provider-order-1',{referenceId:reference,amount:123,currency:'USD'}));
  const courierUser=await services.auth.getUserByEmail('web-courier@example.com');const courierToken=await(await signInWithEmailAndPassword(auth,courierUser.email!,'TestPassword123!')).user.getIdToken();
  await services.db.doc('orders/'+id).update({orderStatus:'with_courier',courierId:courierUser.uid});await services.db.doc('orderSecrets/'+id).set({otpCode:'1234',attempts:0});
  assert.equal((await call({action:'deliver',orderId:id,otpCode:'1234',collectedAmount:1},courierToken,deliveryHandler)).status,400);
  assert.equal((await call({action:'deliver',orderId:id,otpCode:'1234',collectedAmount:0},courierToken,deliveryHandler)).status,200);

 }finally{globalThis.fetch=originalFetch;config.environment=oldEnvironment;Object.assign(config.test,oldTest);}
});
