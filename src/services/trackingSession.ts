import { LocationTrackingFilter,type TrackingPayload } from './locationTrackingFilter';
import type { LocationSource,LocationEvent } from './sharedLocationSource';
export type TrackingWrite={coordinates:{latitude:number;longitude:number};active:boolean};
export interface TrackingState {status:'waiting'|'active'|'reconnecting'|'gps-error'|'paused'|'stopped';point:TrackingWrite['coordinates']|null;message:string;lastWriteAt:number|null;hiddenAt:number|null;awayMs:number;wake:string;accuracyMeters:number|null}
export interface TrackingClock {now:()=>number;interval:(fn:()=>void,ms:number)=>any;clearInterval:(id:any)=>void;timeout:(fn:()=>void,ms:number)=>any;clearTimeout:(id:any)=>void}
export const realTrackingClock:TrackingClock={now:Date.now,interval:setInterval,clearInterval,timeout:setTimeout,clearTimeout};
export function canTrackOrder(order:{courierId?:string;orderStatus:string},uid:string|null|undefined){return !!uid&&order.courierId===uid&&order.orderStatus==='with_courier'}
/** One filter and writer per order. All timers/location are injected for deterministic tests. */
export function startTrackingSession(options:{source:LocationSource;write:(payload:TrackingWrite)=>Promise<void>;notify:(state:TrackingState)=>void;clock?:TrackingClock}){
 const clock=options.clock||realTrackingClock,filter=new LocationTrackingFilter();filter.start(clock.now());
 let stopped=false,hidden=false,pending:TrackingPayload|null=null,writing=false,retry:any=null,failureSince:number|null=null,sendStartedAt:number|null=null,failures=0,lastReliableAt:number|null=null,gpsStale=false,unsubscribe=()=>{};
 const state:TrackingState={status:'waiting',point:null,message:'جارٍ انتظار إشارة GPS…',lastWriteAt:null,hiddenAt:null,awayMs:0,wake:'released',accuracyMeters:null};
 const emit=(patch:Partial<TrackingState>)=>{Object.assign(state,patch);if(!stopped||patch.status==='stopped')options.notify({...state,point:state.point?{...state.point}:null})};
 const inactive=()=>{if(state.point)void options.write({coordinates:{...state.point},active:false}).catch(()=>{});};
 const stop=(message='توقف التتبع.')=>{if(stopped)return;stopped=true;pending=null;clock.clearInterval(heartbeat);if(retry!==null)clock.clearTimeout(retry);retry=null;unsubscribe();inactive();emit({status:'stopped',message});};
 const exhausted=()=>failureSince!==null&&clock.now()-failureSince>=180000;
 const send=async()=>{
  if(stopped||hidden||writing||!pending)return;
  if(exhausted()){stop('توقف التتبع بعد 3 دقائق من فشل الإرسال المتواصل. افتح الصفحة مجددًا بعد إصلاح الاتصال.');return;}
  const payload=pending;pending=null;writing=true;sendStartedAt=clock.now();emit({status:'reconnecting',message:'جارٍ إرسال موقع المندوب…'});
  try{await options.write(payload);if(!stopped){failureSince=null;failures=0;emit({status:hidden?'paused':'active',lastWriteAt:clock.now(),message:hidden?'الصفحة مخفية؛ التتبع متوقف.':'التتبع نشط'});}}
  catch{if(!stopped){pending=pending||payload;failureSince??=clock.now();const delay=[2000,5000,10000][Math.min(failures++,2)];emit({status:'reconnecting',message:'جارٍ إعادة الاتصال…'});if(retry===null)retry=clock.timeout(()=>{retry=null;void send()},delay);}}
  finally{writing=false;sendStartedAt=null;if(!stopped&&!hidden&&retry===null&&pending)void send();}
 };
 const event=(event:LocationEvent)=>{
  if(stopped)return;
  if(event.type==='wake'){emit({wake:event.status});return;}
  if(event.type==='visibility'){
   hidden=event.hidden;
   if(hidden){if(retry!==null)clock.clearTimeout(retry);retry=null;pending=null;filter.markGpsError();inactive();emit({status:'paused',hiddenAt:clock.now(),message:'الصفحة مخفية؛ التتبع متوقف.'});}
   else{if(exhausted()){stop('توقف التتبع بعد 3 دقائق من فشل الإرسال.');return;}filter.start(clock.now());lastReliableAt=null;gpsStale=false;pending=null;emit({status:'waiting',awayMs:event.awayMs,hiddenAt:null,message:event.awayMs?`توقف التتبع منذ ${Math.max(1,Math.ceil(event.awayMs/60000))} دقيقة؛ جارٍ انتظار موقع جديد.`:'جارٍ انتظار موقع جديد.'});}return;
  }
  if(event.type==='error'){filter.markGpsError();pending=null;inactive();emit({status:'gps-error',message:event.message});return;}
  if(hidden)return;
  const r=event.reading,now=clock.now();
  if(!Number.isFinite(r.latitude)||!Number.isFinite(r.longitude)||Math.abs(r.latitude)>90||Math.abs(r.longitude)>180||!Number.isFinite(r.accuracy)||r.accuracy!<0||!Number.isFinite(r.timestamp)||r.timestamp!>now+30000||now-r.timestamp!>30000)return;
  if(r.accuracy!<=30){lastReliableAt=now;gpsStale=false;}
  const payload=filter.evaluate(r,now);if(payload){lastReliableAt=now;gpsStale=false;state.point={...payload.coordinates};state.accuracyMeters=r.accuracy!;pending=payload;emit({});if(retry===null)void send();}
 };
 const heartbeat=clock.interval(()=>{if(stopped)return;if(writing&&sendStartedAt!==null&&clock.now()-sendStartedAt>=180000){stop('توقف التتبع لعدم تأكيد الإرسال خلال 3 دقائق. تحقق من الاتصال وأعد فتح الصفحة.');return;}if(exhausted()){stop('توقف التتبع بعد 3 دقائق من فشل الإرسال المتواصل.');return;}if(hidden)return;if(lastReliableAt!==null&&clock.now()-lastReliableAt>120000){if(!gpsStale){gpsStale=true;filter.markGpsError();pending=null;inactive();emit({status:'gps-error',message:'إشارة GPS الموثوقة قديمة؛ ننتظر قراءة دقيقة جديدة بدل عرض موقع قديم كتتبع حي.'});}return;}const payload=filter.heartbeat(clock.now());if(payload){pending=payload;if(retry===null)void send();}},10000);
 unsubscribe=options.source.subscribe(event);emit({});
 return {stop,getState:()=>({...state})};
}
