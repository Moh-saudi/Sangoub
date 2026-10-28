import type { RawReading } from './locationTrackingFilter';
export type LocationEvent={type:'position';reading:RawReading}|{type:'error';message:string}|{type:'visibility';hidden:boolean;awayMs:number}|{type:'wake';status:'held'|'released'|'unsupported'|'denied'};
export interface LocationSource {subscribe(listener:(event:LocationEvent)=>void):()=>void}
interface WakeHandle {release():Promise<void>;addEventListener?(name:string,listener:()=>void):void}
export interface SourceDependencies {
 watch(success:(reading:RawReading)=>void,error:(message:string)=>void):number;clear(id:number):void;
 hidden():boolean;listenVisibility(listener:()=>void):()=>void;now():number;
 requestWake?:()=>Promise<WakeHandle>;
}
/** Exactly one foreground watch and Wake Lock per page, regardless of active order count. */
export function createSharedLocationSource(deps:SourceDependencies):LocationSource{
 const listeners=new Set<(event:LocationEvent)=>void>();let watch:number|undefined,wake:WakeHandle|undefined,acquiring=false,unlisten:(()=>void)|undefined,hiddenAt:number|null=null;
 const emit=(event:LocationEvent)=>{for(const listener of [...listeners])listener(event)};
 const release=()=>{const previous=wake;wake=undefined;if(previous)void previous.release().catch(()=>{});};
 const acquire=async()=>{
  if(!listeners.size||deps.hidden()||wake||acquiring)return;
  if(!deps.requestWake){emit({type:'wake',status:'unsupported'});return;}
  acquiring=true;
  try{const handle=await deps.requestWake();if(!listeners.size||deps.hidden()){await handle.release();return;}wake=handle;handle.addEventListener?.('release',()=>{if(wake===handle)wake=undefined;emit({type:'wake',status:'released'})});emit({type:'wake',status:'held'});}catch{emit({type:'wake',status:'denied'});}finally{acquiring=false;}
 };
 const startWatch=()=>{if(watch!==undefined||deps.hidden()||!listeners.size)return;try{watch=deps.watch(reading=>emit({type:'position',reading}),message=>emit({type:'error',message}));}catch{emit({type:'error',message:'المتصفح لا يدعم تحديد الموقع أو لم يسمح به.'});}};
 const stopWatch=()=>{if(watch!==undefined)deps.clear(watch);watch=undefined;};
 const visible=()=>{
  if(deps.hidden()){hiddenAt=deps.now();emit({type:'visibility',hidden:true,awayMs:0});stopWatch();release();}
  else{const awayMs=hiddenAt===null?0:deps.now()-hiddenAt;hiddenAt=null;emit({type:'visibility',hidden:false,awayMs});startWatch();void acquire();}
 };
 return {subscribe(listener){listeners.add(listener);if(listeners.size===1){unlisten=deps.listenVisibility(visible);if(deps.hidden()){hiddenAt=deps.now();listener({type:'visibility',hidden:true,awayMs:0})}else{startWatch();void acquire();}}else listener({type:'wake',status:wake?'held':deps.requestWake?'released':'unsupported'});
  let removed=false;return()=>{if(removed)return;removed=true;listeners.delete(listener);if(!listeners.size){stopWatch();release();unlisten?.();unlisten=undefined;hiddenAt=null;}};
 }};
}
let singleton:LocationSource|undefined;
export function browserLocationSource():LocationSource{
 return singleton??=createSharedLocationSource({
  watch:(success,error)=>{if(!navigator.geolocation)throw Error('No GPS');return navigator.geolocation.watchPosition(p=>success({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),()=>error('تعذر تحديد الموقع. راجع إذن GPS واتصال الجهاز.'),{enableHighAccuracy:true,timeout:15000,maximumAge:0})},
  clear:id=>navigator.geolocation.clearWatch(id),hidden:()=>document.hidden,now:Date.now,
  listenVisibility:listener=>{document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener)},
  requestWake:typeof navigator!=='undefined'&&'wakeLock' in navigator?()=>navigator.wakeLock.request('screen'):undefined,
 });
}
