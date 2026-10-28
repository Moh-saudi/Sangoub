import type {Coordinates} from './osmRouting';
export type ObservedTracking={status:'waiting'|'tracking'|'disconnected'|'inactive'|'delivered'|'cancelled'|'unavailable';point:Coordinates|null;lastArrivalAt:number|null};
export function startTrackingObserver(options:{orderStatus:string;listen:(data:(value:any,fromCache?:boolean)=>void,error:()=>void)=>()=>void;notify:(state:ObservedTracking)=>void;now?:()=>number;every?:(fn:()=>void,ms:number)=>any;clear?:(id:any)=>void}){
 const now=options.now||Date.now,every=options.every||setInterval,clear=options.clear||clearInterval;
 let alive=true,revision='',active=false;const state:ObservedTracking={status:options.orderStatus==='delivered'?'delivered':options.orderStatus==='cancelled'?'cancelled':'waiting',point:null,lastArrivalAt:null};
 const emit=(patch:Partial<ObservedTracking>)=>{if(alive){Object.assign(state,patch);options.notify({...state})}};
 if(options.orderStatus!=='with_courier'){emit({});return()=>{alive=false}}
 const stop=options.listen((data,cached=false)=>{
  if(!alive)return;
  const p=data?.coordinates;active=data?.active===true&&p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
  if(!data){emit({status:'waiting',point:null});return;}
  if(!active){emit({status:'inactive'});return;}
  if(cached){emit({status:'disconnected',point:{latitude:p.latitude,longitude:p.longitude}});return;}
  const timestamp=data.updatedAt;const next=timestamp?.toMillis?.()??(timestamp?.seconds!==undefined?`${timestamp.seconds}:${timestamp.nanoseconds}`:JSON.stringify([p.latitude,p.longitude,data.active]));
  if(state.lastArrivalAt===null||String(next)!==revision){revision=String(next);emit({status:'tracking',point:{latitude:p.latitude,longitude:p.longitude},lastArrivalAt:now()});}
 },()=>emit({status:'unavailable'}));
 const timer=every(()=>{if(active&&state.lastArrivalAt!==null&&now()-state.lastArrivalAt>120000)emit({status:'disconnected'})},5000);
 return()=>{alive=false;stop();clear(timer)};
}
