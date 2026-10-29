import {useEffect,useMemo,useState,useRef} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';import {onAuthStateChanged} from 'firebase/auth';
import {auth,db} from '../lib/firebase';import type {Order,Store} from '../types';
import {TrackingMap} from './TrackingMap';import {trackingStatusText} from './OrderMap';
import {startTrackingObserver,type ObservedTracking} from '../services/trackingObserver';import {useOsmRoute} from '../services/useOsmRoute';
/** Admin map: bounded, per-active-order documents. No blanket tracking collection listener. */
export function CouriersLiveMap({orders,stores:_stores,couriers,connected}:{orders:Order[];stores:Store[];couriers:Array<{id:string;name:string;phone:string}>;connected:boolean}){
 const [uid,setUid]=useState(auth.currentUser?.uid),[states,setStates]=useState<Record<string,ObservedTracking>>({}),[selected,setSelected]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>onAuthStateChanged(auth,user=>setUid(user?.uid)),[]);
 const active=orders.filter(o=>o.orderStatus==='with_courier'&&o.courierId),ids=active.slice(0,50).map(o=>o.id).sort().join('|');
 const subscriptions=useRef(new Map<string,()=>void>());
 useEffect(()=>{setStates({});return()=>{subscriptions.current.forEach(stop=>stop());subscriptions.current.clear()}},[uid]);
 useEffect(()=>{
  const wanted=new Set(uid&&ids?ids.split('|'):[]);
  for(const[id,stop]of subscriptions.current)if(!wanted.has(id)){stop();subscriptions.current.delete(id)}
  setStates(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>wanted.has(id))));
  for(const id of wanted)if(!subscriptions.current.has(id))subscriptions.current.set(id,startTrackingObserver({orderStatus:'with_courier',notify:state=>{if(auth.currentUser?.uid===uid)setStates(prev=>({...prev,[id]:state}))},listen:(next,error)=>onSnapshot(doc(db,'tracking',id),{includeMetadataChanges:true},snap=>next(snap.exists()?snap.data():null,snap.metadata.fromCache),error)}));
 },[uid,ids]);

 const visible=active.slice(0,50).filter(o=>`${o.orderNumber} ${o.courierName||''} ${o.ministry||''}`.includes(search));
 const order=visible.find(o=>o.id===selected)||visible[0],state=order?states[order.id]:null;
 const {route,remaining}=useOsmRoute(state?.status==='tracking'?state.point:null,order?.coordinates,order?.id);
 const peers=useMemo(()=>active.slice(0,50).flatMap(o=>states[o.id]?.point&&o.id!==order?.id?[{id:o.id,point:states[o.id].point!,label:`${o.courierName||'مندوب'} · ${o.orderNumber}`,stale:states[o.id].status!=='tracking'}]:[]),[ids,states,order?.id]);
 return <section aria-label="خريطة المناديب والرحلات الحية" className="rounded-2xl border bg-white p-4 space-y-3" dir="rtl">
 <h2 className="font-bold text-lg">خريطة المناديب والرحلات الحية</h2><p role="status">{connected?'اتصال الإدارة متاح':'اتصال الإدارة غير مؤكد'} · {active.length} رحلة توصيل · {couriers.length} مندوب مسجل</p>
 <label>البحث في الرحلات<input value={search} onChange={e=>setSearch(e.target.value)} className="block w-full border rounded-lg p-2"/></label>
 {active.length>50&&<p>تعرض الخريطة أول 50 رحلة نشطة لتقييد عدد الاشتراكات.</p>}
 <div className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2">{order?<><TrackingMap mapKey={order.id} point={state?.point} destination={order.coordinates} route={state?.status==='tracking'?route:null} live={state?.status==='tracking'} peers={peers} onSelectPeer={setSelected}/><p>{trackingStatusText[state?.status||'waiting']}</p>{remaining&&state?.status==='tracking'&&<p>{route?.isFallback?'تقدير خط مستقيم':'المتبقي تقديريًا'}: {Math.ceil(remaining.durationSeconds/60)} دقيقة</p>}</>:<p>لا توجد رحلات توصيل مطابقة. لا تُعرض مواقع افتراضية.</p>}</div>
 <div className="space-y-2 max-h-96 overflow-y-auto">{visible.map(o=><button type="button" key={o.id} aria-pressed={o.id===order?.id} className="block w-full rounded-xl border p-3 text-right" onClick={()=>setSelected(o.id)}><strong>{o.orderNumber} · {o.courierName||'المندوب المسند'}</strong><span className="block text-xs">{trackingStatusText[states[o.id]?.status||'waiting']}</span></button>)}</div></div>
 </section>;
}
