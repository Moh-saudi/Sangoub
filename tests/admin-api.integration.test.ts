import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, confirmPasswordReset } from 'firebase/auth';
import { adminServices } from '../server/firebaseAdmin.ts';
import users from '../api/admin-users.ts';
import data from '../api/admin-data.ts';
import { auditSafe } from '../server/audit.ts';
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_PROJECT_ID='demo-capital-talabat';process.env.FIREBASE_DATABASE_ID='(default)';
const app=initializeApp({apiKey:'demo',projectId:'demo-capital-talabat'},'admin-api-tests');const client=getAuth(app);connectAuthEmulator(client,'http://127.0.0.1:9099',{disableWarnings:true});const services=adminServices();let token='',employeeToken='',uid='';
async function invoke(body:any,handler=users,bearer=token){let status=200,result:any;await handler({method:'POST',headers:{authorization:'Bearer '+bearer},body},{setHeader(){},status(code:number){status=code;return this;},json(value:any){result=value;return this;}});return{status,result};}
before(async()=>{
 const admin=await services.auth.createUser({email:'audit-admin@example.com',emailVerified:true,password:'TestPassword123!'});uid=admin.uid;await services.db.doc('admins/'+uid).set({active:true});token=await(await signInWithEmailAndPassword(client,'audit-admin@example.com','TestPassword123!')).user.getIdToken();
 await services.auth.createUser({email:'audit-employee@example.com',emailVerified:true,password:'TestPassword123!'});employeeToken=await(await signInWithEmailAndPassword(client,'audit-employee@example.com','TestPassword123!')).user.getIdToken();
 await services.db.doc('stores/admin-api-store').set({name:'متجر اختبار',status:'open',minOrder:0,deliveryFee:0});
});
after(async()=>{await deleteApp(app);});
test('non-admins cannot list auth users, mutate data or read audit records',async()=>{
 for(const [body,handler] of [[{action:'list'},users],[{action:'audit'},data],[{action:'save',collection:'stores',id:'forged',data:{}},data]] as const)assert.equal((await invoke(body,handler,employeeToken)).status,403);
});
test('create, update, assign role, revoke, disable, enable and delete a real Auth account with audit history',async()=>{
 const created=await invoke({action:'create',email:'managed-user@example.com',fullName:'مستخدم حقيقي بالمحاكي',phone:'01012345678',role:'employee',reason:'اختبار إنشاء حساب'});assert.equal(created.status,200,JSON.stringify(created.result));const target=created.result.uid;
 assert.equal((await services.auth.getUser(target)).emailVerified,false);assert.equal((await services.db.doc('users/'+target).get()).data()?.walletBalance,0);
 assert.equal((await invoke({action:'update',uid:target,email:'managed-user@example.com',fullName:'اسم معدل',phone:'01012345678',ministry:'جهة اختبار',floorNumber:'2',roomNumber:'5',reason:'تصحيح بيانات المستخدم'})).status,200);
 assert.equal((await invoke({action:'role',uid:target,role:'restaurant',storeId:'admin-api-store',reason:'تعيين المستخدم شيفًا'})).status,200);assert.equal((await services.db.doc('staff/'+target).get()).data()?.storeId,'admin-api-store');
 assert.equal((await invoke({action:'revoke',uid:target,reason:'إلغاء جلسات الاختبار'})).status,200);assert((await services.db.doc('accountAccess/'+target).get()).data()?.revokedBefore>0);
 assert.equal((await invoke({action:'disable',uid:target,reason:'إيقاف حساب الاختبار'})).status,200);assert.equal((await services.auth.getUser(target)).disabled,true);assert.equal((await services.db.doc('staff/'+target).get()).exists,false);
 assert.equal((await invoke({action:'enable',uid:target,reason:'إعادة تفعيل الحساب'})).status,200);assert.equal((await services.auth.getUser(target)).disabled,false);assert.equal((await services.db.doc('staff/'+target).get()).exists,false);
 assert.equal((await invoke({action:'delete',uid:target,confirmation:'wrong',reason:'اختبار حماية الحذف'})).status,400);
 assert.equal((await invoke({action:'delete',uid:target,confirmation:target,reason:'حذف مستخدم الاختبار'})).status,200);await assert.rejects(services.auth.getUser(target));
 const logs=await services.db.collection('auditLogs').where('entityId','==',target).get();assert.equal(logs.docs.filter(doc=>doc.data().status==='success').length,7);assert(logs.docs.some(doc=>doc.data().status==='blocked'));assert.equal((await services.db.doc('users/'+target).get()).data()?.email,'');
});
test('self-demotion, self-disabling and forged role/financial updates are rejected',async()=>{
 for(const action of ['role','disable','delete','revoke'])assert.equal((await invoke({action,uid,role:'employee',confirmation:uid,reason:'اختبار منع تغيير الذات'})).status,409);
 assert.equal((await invoke({action:'save',collection:'users',id:uid,data:{walletBalance:100000}},data)).status,400);
 assert.equal((await invoke({action:'create',email:'x@example.com',fullName:'x',reason:'اختبار غياب الدور'})).status,400);
});
test('catalog mutation and immutable audit event commit together; forged totals and unregistered courier are rejected',async()=>{
 const saved=await invoke({action:'save',collection:'stores',id:'audited-store',data:{id:'audited-store',name:'متجر مدقق',minOrder:0,deliveryFee:10,status:'closed'}},data);assert.equal(saved.status,200,JSON.stringify(saved.result));
 const logs=await services.db.collection('auditLogs').where('entityId','==','audited-store').get();assert.equal(logs.size,1);assert.equal(logs.docs[0].data().actorUid,uid);assert.equal(logs.docs[0].data().after.name,'متجر مدقق');
 await services.db.doc('orders/audited-order').set({orderStatus:'ready',total:120});
 assert.equal((await invoke({action:'save',collection:'orders',id:'audited-order',data:{total:0}},data)).status,400);
 assert.equal((await invoke({action:'save',collection:'orders',id:'audited-order',data:{orderStatus:'with_courier',courierId:'missing-courier'}},data)).status,400);
 assert.equal((await invoke({action:'save',collection:'orders',id:'audited-order',data:{orderStatus:'delivered'}},data)).status,400);
 const query=await invoke({action:'audit',filterBy:'entityType',filterValue:'stores'},data);assert.equal(query.status,200);assert(query.result.events.some((row:any)=>row.entityId==='audited-store'));
});
test('active courier assignments prevent role changes and disable; Auth failure remains visible without locking the next operation',async()=>{
 const courier=await services.auth.createUser({email:'busy-courier@example.com',emailVerified:true});await services.db.doc('staff/'+courier.uid).set({role:'courier',name:'مندوب اختبار',phone:'01012345678'});await services.db.doc('orders/busy-order').set({orderStatus:'with_courier',courierId:courier.uid});
 assert.equal((await invoke({action:'disable',uid:courier.uid,reason:'اختبار منع تعطيل مندوب مشغول'})).status,409);
 const failed=await invoke({action:'create',email:'audit-admin@example.com',fullName:'بريد مكرر',role:'employee',reason:'اختبار تكرار البريد'});assert.equal(failed.status,409);assert.equal((await services.db.doc('adminControl/membership').get()).exists,false);
 const logs=await services.db.collection('auditLogs').where('status','==','failed').get();assert(logs.size>=1);
});
test('audit strips credentials recursively and keeps meaningful changes',()=>{
 const result=auditSafe({password:'never-log',profile:{email:'visible@example.com',idToken:'secret'},otpCode:'1234',uploadUrl:'signed'});assert.deepEqual(result,{profile:{email:'visible@example.com'}});
});

test('an ambiguous Auth network result leaves a partial audit and a lock for review',async()=>{
 const original=services.auth.createUser.bind(services.auth);let createdUid='';
 services.auth.createUser=async properties=>{const user=await original(properties);createdUid=user.uid;throw Object.assign(new Error('Simulated lost acknowledgement'),{code:'auth/network-request-failed'});};
 try{
  const result=await invoke({action:'create',email:'ambiguous-auth@example.com',fullName:'اختبار نتيجة غير مؤكدة',role:'employee',reason:'اختبار انقطاع الاتصال بعد الكتابة'});assert.equal(result.status,503);assert(createdUid);
  const lock=await services.db.doc('adminUserLocks/'+createdUid).get();assert(lock.exists);assert.equal((await services.db.doc('auditLogs/'+lock.data()!.operationId).get()).data()?.status,'partial');assert.equal((await services.auth.getUser(createdUid)).email,'ambiguous-auth@example.com');
 }finally{services.auth.createUser=original;if(createdUid){await services.auth.deleteUser(createdUid);await services.db.doc('adminUserLocks/'+createdUid).delete();await services.db.doc('accountAccess/'+createdUid).delete();await services.db.doc('adminControl/membership').delete();}}
});
test('an imported offer can be assigned its first store before enabling orders, while linked products cannot move stores', async () => {
 const id='unassigned-offer';
 await services.db.doc('products/'+id).set({id,name:'عرض مستورد',description:'منتج غير مرتبط بمتجر بعد',storeId:'',storeName:'كتالوج مستورد',category:'وجبات خفيفة',price:20,originalPrice:40,inStock:false,archived:false});
 const attempt=await invoke({action:'save',collection:'products',id,data:{inStock:true}},data);
 assert.equal(attempt.status,400);assert.match(attempt.result.error,/اختر المتجر/);
 assert.equal((await services.db.doc('products/'+id).get()).data()?.storeId,'');
 const missingStore=await invoke({action:'save',collection:'products',id,data:{storeId:'missing-store',inStock:true}},data);
 assert.equal(missingStore.status,400);
 const unauthorized=await invoke({action:'save',collection:'products',id,data:{storeId:'admin-api-store',inStock:true}},data,employeeToken);
 assert.equal(unauthorized.status,403);
 const assigned=await invoke({action:'save',collection:'products',id,data:{storeId:'admin-api-store',storeName:'متجر اختبار',inStock:true}},data);
 assert.equal(assigned.status,200,JSON.stringify(assigned.result));
 const product=(await services.db.doc('products/'+id).get()).data()!;
 assert.equal(product.storeId,'admin-api-store');assert.equal(product.inStock,true);assert.equal(product.price,20);assert.equal(product.originalPrice,40);
 const moved=await invoke({action:'save',collection:'products',id,data:{storeId:'audited-store',inStock:true}},data);
 assert.equal(moved.status,400);assert.match(moved.result.error,/لا يمكن نقل/);
 const logs=await services.db.collection('auditLogs').where('entityId','==',id).get();
 const success=logs.docs.map(doc=>doc.data()).filter(log=>log.status==='success');
 assert.equal(success.length,1);assert.equal(success[0].before.storeId,'');assert.equal(success[0].after.storeId,'admin-api-store');
});

test('store-team onboarding returns a private password-setup link and persists the assigned duty',async()=>{
 const result=await invoke({action:'create',email:'store-team-onboarding@example.com',fullName:'مسؤول تحضير',phone:'01012345678',role:'restaurant',duty:'preparer',storeId:'admin-api-store',reason:'إنشاء حساب فريق المتجر'});
 assert.equal(result.status,200,JSON.stringify(result.result));assert.equal(typeof result.result.resetLink,'string');
 const staff=(await services.db.doc('staff/'+result.result.uid).get()).data()!;assert.equal(staff.storeId,'admin-api-store');assert.equal(staff.duty,'preparer');assert.equal((await services.auth.getUser(result.result.uid)).emailVerified,false);
 const logs=await services.db.collection('auditLogs').where('entityId','==',result.result.uid).get();assert(!JSON.stringify(logs.docs.map(doc=>doc.data())).includes(result.result.resetLink));
});
test('all created accounts receive a one-use password setup link without exposing it in stored profiles or audit',async()=>{
 const email='password-onboarding@example.com';
 const created=await invoke({action:'create',email,fullName:'اختبار تفعيل الحساب',role:'employee',reason:'اختبار رابط تعيين كلمة مرور العميل'});
 assert.equal(created.status,200,JSON.stringify(created.result));assert.equal(typeof created.result.resetLink,'string');
 const target=created.result.uid,code=new URL(created.result.resetLink).searchParams.get('oobCode')!;
 const profile=(await services.db.doc('users/'+target).get()).data();
 const logs=await services.db.collection('auditLogs').where('entityId','==',target).get();
 assert(!JSON.stringify([profile,...logs.docs.map(d=>d.data())]).includes(code));
 assert.equal(profile?.password,undefined);assert.equal(created.result.password,undefined);
 await assert.rejects(signInWithEmailAndPassword(client,email,'WrongPassword123!'));
 await confirmPasswordReset(client,code,'AccountOwnerPassword123!');
 await assert.rejects(confirmPasswordReset(client,code,'AnotherPassword123!'));
 assert.equal((await signInWithEmailAndPassword(client,email,'AccountOwnerPassword123!')).user.uid,target);
 const reset=await invoke({action:'reset',uid:target,reason:'طلب صاحب الحساب إعادة تعيين كلمة مروره'});assert.equal(reset.status,200);assert.equal(typeof reset.result.resetLink,'string');
 const blocked=await invoke({action:'update',uid:target,email,fullName:'اسم',password:'PlaintextPassword123!',reason:'اختبار رفض كلمة المرور في بيانات الملف'});assert.equal(blocked.status,400);
});
test('editing assignment persists the selected role/store/duty and protects active assignments and self access',async()=>{
 const created=await invoke({action:'create',email:'assignment-edit@example.com',fullName:'اختبار تعديل الحساب',role:'employee',reason:'إنشاء حساب اختبار التعديل'});assert.equal(created.status,200);
 const target=created.result.uid;
 const update=await invoke({action:'update',uid:target,email:'assignment-edit@example.com',fullName:'مسؤول المتجر الجديد',role:'restaurant',storeId:'admin-api-store',duty:'manager',reason:'ربط الحساب بالمتجر وتعيين مديره'});
 assert.equal(update.status,200,JSON.stringify(update.result));assert.equal((await services.db.doc('staff/'+target).get()).data()?.duty,'manager');assert.equal((await services.db.doc('users/'+target).get()).data()?.role,'restaurant');assert((await services.db.doc('accountAccess/'+target).get()).data()?.revokedBefore>0);
 await services.db.doc('orders/assignment-edit-active').set({storeIds:['admin-api-store'],orderStatus:'preparing'});
 const contactOnly=await invoke({action:'update',uid:target,email:'assignment-edit@example.com',fullName:'اسم الاتصال المعدل',role:'restaurant',storeId:'admin-api-store',duty:'manager',reason:'تصحيح اسم مسؤول المتجر دون تغيير تكليفه'});assert.equal(contactOnly.status,200,JSON.stringify(contactOnly.result));
 const blocked=await invoke({action:'update',uid:target,email:'assignment-edit@example.com',fullName:'اسم معدل',role:'courier',reason:'محاولة تغيير دور له طلب نشط'});assert.equal(blocked.status,409);
 assert.equal((await services.db.doc('staff/'+target).get()).data()?.role,'restaurant');
 await services.db.doc('orders/assignment-edit-active').delete();
 assert.equal((await invoke({action:'update',uid,email:'audit-admin@example.com',fullName:'المدير',role:'courier',reason:'اختبار منع تغيير صلاحية النفس'})).status,409);
});

test('concurrent administrators cannot disable each other and remove all management access',async()=>{
 const other=await services.auth.createUser({email:'second-audit-admin@example.com',emailVerified:true,password:'TestPassword123!'});await services.db.doc('admins/'+other.uid).set({active:true});
 const otherToken=await(await signInWithEmailAndPassword(client,'second-audit-admin@example.com','TestPassword123!')).user.getIdToken();
 const results=await Promise.all([invoke({action:'disable',uid:other.uid,reason:'اختبار تزامن تغيير المديرين'}),invoke({action:'disable',uid,reason:'اختبار تزامن تغيير المديرين'},users,otherToken)]);
 assert.equal(results.filter(result=>result.status===200).length,1,JSON.stringify(results));assert(results.some(result=>[401,403,409].includes(result.status)));
 assert.equal((await services.db.collection('admins').get()).size,1);assert.equal((await services.db.doc('adminControl/membership').get()).exists,false);
});
