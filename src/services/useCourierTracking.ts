import { useEffect,useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc,setDoc,serverTimestamp } from 'firebase/firestore';
import { auth,db } from '../lib/firebase';
import { browserLocationSource } from './sharedLocationSource';
import { canTrackOrder,startTrackingSession,type TrackingState } from './trackingSession';
import type { CourierTrackingOrder } from '../components/CourierTracking';
/** saveRecord is an admin API; tracking uses its own rule-protected document write. */
export function useCourierTracking(order:CourierTrackingOrder){
 const [uid,setUid]=useState(auth.currentUser?.uid),[state,setState]=useState<TrackingState|null>(null);
 useEffect(()=>onAuthStateChanged(auth,u=>setUid(u?.uid)),[]);
 const [revision,setRevision]=useState(0);
 const eligible=canTrackOrder(order,uid);
 useEffect(()=>{
  setState(null);if(!eligible)return;let mounted=true;
  const session=startTrackingSession({source:browserLocationSource(),notify:s=>{if(mounted)setState(s)},write:async payload=>{
   if(auth.currentUser?.uid!==order.courierId)throw Error('انتهت جلسة المندوب.');
   await setDoc(doc(db,'tracking',order.id),{coordinates:payload.coordinates,active:payload.active,updatedAt:serverTimestamp()});
  }});
  return()=>{mounted=false;session.stop()};
 },[eligible,uid,order.id,order.courierId,revision]);
 return {eligible,state,restart:()=>setRevision(value=>value+1)};
}
