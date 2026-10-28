import {readFile,stat} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {LocationTrackingFilter} from '../src/services/locationTrackingFilter.ts';import {haversineDistanceMeters,type Coordinates} from '../src/services/osmRouting.ts';
export function assertSimulatorEnvironment(env:Record<string,string|undefined>){
 const host=env.FIRESTORE_EMULATOR_HOST||'';
 if(!/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(host)||Number(host.split(':')[1])>65535||(env.FIREBASE_PROJECT_ID&&env.FIREBASE_PROJECT_ID!=='demo-capital-talabat'))throw Error('Refusing simulator: loopback FIRESTORE_EMULATOR_HOST and project demo-capital-talabat only.');
 return {projectId:'demo-capital-talabat',host};
}
export function validateSimulationRoute(data:any):Coordinates[]{
 if(!data||!['synthetic','recorded'].includes(data.kind)||!Array.isArray(data.points)||data.points.length<2||data.points.length>10000)throw Error('Route JSON requires explicit kind synthetic/recorded and 2..10000 points.');
 for(const p of data.points)if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||p.latitude<29.85||p.latitude>30.2||p.longitude<31.5||p.longitude>31.95)throw Error('Simulation point outside development NAC bounding box.');
 return data.points;
}
export function* simulationFrames(points:Coordinates[],speedKmh:number,pauseSeconds=0,outageAt=-1,outageSeconds=0){
 if(!Number.isFinite(speedKmh)||speedKmh<1||speedKmh>90||!Number.isFinite(pauseSeconds)||pauseSeconds<0||pauseSeconds>3600||!Number.isFinite(outageAt)||!Number.isFinite(outageSeconds)||outageSeconds<0||outageSeconds>3600)throw Error('Invalid simulator timing/speed.');
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)!+haversineDistanceMeters(points[i-1],points[i]));const total=cumulative.at(-1)!;if(total<=0)throw Error('Route requires positive distance.');
 const duration=Math.ceil(total/(speedKmh/3.6)/10)*10;if(duration+pauseSeconds>36000)throw Error('Simulation exceeds ten hours.');
 for(let elapsed=0;elapsed<=duration+pauseSeconds;elapsed+=10){const travelled=Math.min(total,elapsed*speedKmh/3.6);let i=Math.max(1,cumulative.findIndex(v=>v>=travelled));if(i<1)i=points.length-1;const length=cumulative[i]-cumulative[i-1],t=length?(travelled-cumulative[i-1])/length:0;const a=points[i-1],b=points[i];yield {elapsedSeconds:elapsed,coordinates:{latitude:a.latitude+(b.latitude-a.latitude)*t,longitude:a.longitude+(b.longitude-a.longitude)*t},outage:outageAt>=0&&elapsed>=outageAt&&elapsed<outageAt+outageSeconds,stationary:elapsed>=duration};}
}
async function main(){
 const {projectId}=assertSimulatorEnvironment(process.env); // Guard BEFORE importing/initializing any Admin SDK.
 const args=process.argv.slice(2),arg=(key:string,defaultValue:string)=>{const i=args.indexOf(key);return i<0?defaultValue:args[i+1]||defaultValue};
 const file=arg('--route','scripts/fixtures/nac-synthetic-route.json'),orderId=arg('--order','sim-order'),courierId=arg('--courier','sim-courier'),customerId=arg('--customer','sim-customer');
 for(const id of [orderId,courierId,customerId])if(!/^[\w-]{1,128}$/.test(id))throw Error('Invalid emulator document ID.');
 if(!file.endsWith('.json')||(await stat(file)).size>1024*1024)throw Error('Route must be a JSON file <=1MiB.');const route=JSON.parse(await readFile(file,'utf8')),points=validateSimulationRoute(route);
 const speed=Number(arg('--speed','20')),pause=Number(arg('--pause','0')),outage=Number(arg('--outage','0')),outageAt=Number(arg('--outage-at','-1'));
 const frames=[...simulationFrames(points,speed,pause,outageAt,outage)];
 const {initializeApp,deleteApp}=await import('firebase-admin/app'),{getFirestore,FieldValue}=await import('firebase-admin/firestore');
 const app=initializeApp({projectId,credential:{getAccessToken:async()=>({access_token:'owner',expires_in:3600})}},'gps-simulator');const db=getFirestore(app,'(default)');let stopped=false,last:Coordinates|null=null;
 const interrupt=()=>{stopped=true};process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
 try{
  const order=db.doc('orders/'+orderId);
  if(args.includes('--seed'))await order.set({orderStatus:'with_courier',courierId,profileId:customerId,coordinates:points.at(-1),orderNumber:'SYNTHETIC-DEMO',items:[],total:0});
  const document=await order.get();if(document.data()?.courierId!==courierId||document.data()?.orderStatus!=='with_courier')throw Error('Emulator order must be assigned and with_courier. Use --seed for a synthetic fixture.');
  console.log(`Simulator project=${projectId} route=${route.kind}; synthetic points are NOT real roads. No Auth accounts are created.`);
  const filter=new LocationTrackingFilter();filter.start(Date.now());
  for(const frame of frames){if(stopped)break;if(frame.elapsedSeconds)await new Promise(resolve=>setTimeout(resolve,10000));if(stopped)break;if(frame.outage){filter.markGpsError();continue;}const now=Date.now();const payload=filter.evaluate({...frame.coordinates,accuracy:5,timestamp:now},now)||filter.heartbeat(now);if(payload){last=payload.coordinates;await db.doc('tracking/'+orderId).set({...payload,updatedAt:FieldValue.serverTimestamp()});console.log(`demo frame=${frame.elapsedSeconds}s stationary=${frame.stationary}`);}}
 }finally{if(last)await db.doc('tracking/'+orderId).set({coordinates:last,active:false,updatedAt:FieldValue.serverTimestamp()});process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await deleteApp(app);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error instanceof Error?error.message:'Simulator failed');process.exitCode=1});
