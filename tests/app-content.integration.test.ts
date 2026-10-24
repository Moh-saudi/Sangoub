import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {adminServices} from '../server/firebaseAdmin.ts';
import handler from '../api/app-content.ts';
import {defaultCustomerHome} from '../src/types/appContent.ts';
process.env.FIREBASE_PROJECT_ID='demo-capital-talabat';process.env.FIREBASE_DATABASE_ID='(default)';
const services=adminServices();const app=initializeApp({apiKey:'demo',projectId:'demo-capital-talabat'},'content-test');const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});let token='';
async function call(body:any={},method='POST',bearer=token){let status=200,result:any;await handler({method,headers:bearer?{authorization:'Bearer '+bearer}:{},body},{setHeader(){},status(v:number){status=v;return this;},json(v:any){result=v;return this;}});return{status,result};}
before(async()=>{const user=await services.auth.createUser({email:'content-admin@example.com',emailVerified:true,password:'TestPassword123!'});await services.db.doc('admins/'+user.uid).set({active:true});token=await(await signInWithEmailAndPassword(auth,user.email!,'TestPassword123!')).user.getIdToken();await services.db.doc('stores/content-store').set({name:'متجر المحتوى',status:'open'});await services.db.doc('products/content-product').set({name:'عرض المحتوى',storeId:'content-store',inStock:true,price:25,originalPrice:50,imageUrl:'https://example.com/image.png'});});
after(async()=>{await deleteApp(app);});
test('presentation writes require an administrator and validate all section identities',async()=>{
 assert.equal((await call({action:'save-home',config:defaultCustomerHome},'POST','')).status,401);
 assert.equal((await call({action:'save-home',config:{...defaultCustomerHome,sections:[{type:'unknown',enabled:true}]}})).status,400);
 assert.equal((await call({action:'save-home',config:defaultCustomerHome})).status,200);
 const publicView=await call({},'GET','');assert.equal(publicView.status,200);assert.equal(publicView.result.schemaVersion,1);assert(publicView.result.slides.some((slide:any)=>slide.targetId==='content-product'));assert.equal(publicView.result.operationsReady,undefined);
});
test('manual campaigns obey schedule, real availability, strict fields and trusted targets',async()=>{
 const campaign={title:'خصم حقيقي',subtitle:'عرض الاختبار',imageUrl:'https://example.com/banner.png',enabled:true,priority:1,targetType:'product',targetId:'content-product',startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString()};
 assert.equal((await call({action:'save-campaign',id:'content-campaign',campaign:{...campaign,secret:'forged'}})).status,400);
 assert.equal((await call({action:'save-campaign',id:'content-campaign',campaign})).status,200);
 assert.equal((await call({action:'save-home',config:{...defaultCustomerHome,sliderMode:'manual'}})).status,200);
 assert.equal((await call({},'GET','')).result.slides.length,1);
 await services.db.doc('products/content-product').update({inStock:false});assert.equal((await call({},'GET','')).result.slides.length,0);
 await services.db.doc('products/content-product').update({inStock:true});
 await call({action:'save-campaign',id:'content-campaign',campaign:{...campaign,startsAt:new Date(Date.now()-120000).toISOString(),endsAt:new Date(Date.now()-60000).toISOString()}});assert.equal((await call({},'GET','')).result.slides.length,0);
});
test('rollout cannot be enabled before the runtime prerequisite is explicitly set',async()=>{process.env.OPERATIONS_V2_READY='false';assert.equal((await call({action:'save-operations',enabled:true})).status,409);assert.equal((await call({action:'save-operations',enabled:false})).status,200);});
