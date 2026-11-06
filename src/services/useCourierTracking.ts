import { useEffect,useState } from 'react';
import { supabase } from '../lib/supabase';
import { operationsApi } from '../lib/operationsApi';
import { browserLocationSource } from './sharedLocationSource';
import { canTrackOrder,startTrackingSession,type TrackingState } from './trackingSession';
import type { CourierTrackingOrder } from '../components/CourierTracking';
/** saveRecord is an admin API; tracking uses its own rule-protected document write. */
export function useCourierTracking(order:CourierTrackingOrder){
 const [uid,setUid]=useState<string>(),[state,setState]=useState<TrackingState|null>(null);
 useEffect(()=>{
  let active=true;
  void supabase.auth.getUser().then(({data:{user}})=>{if(active)setUid(user?.id)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUid(session?.user.id));
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 const [revision,setRevision]=useState(0);
 const eligible=canTrackOrder(order,uid);
 useEffect(()=>{
  setState(null);if(!eligible)return;let mounted=true;
  const session=startTrackingSession({source:browserLocationSource(),notify:s=>{if(mounted)setState(s)},write:async payload=>{
   const {data:{user}}=await supabase.auth.getUser();
   if(user?.id!==order.courierId)throw Error('انتهت جلسة المندوب.');
   await operationsApi('operations',{action:'courier-location',orderId:order.id,coordinates:payload.coordinates,active:payload.active});
  }});
  return()=>{mounted=false;session.stop()};
 },[eligible,uid,order.id,order.courierId,revision]);
 return {eligible,state,restart:()=>setRevision(value=>value+1)};
}
