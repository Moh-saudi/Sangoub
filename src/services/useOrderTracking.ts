import {listenMerchantTracking} from './merchantTrackingClient';
import {apiUrl} from '../lib/apiUrl';
import {useEffect,useState} from 'react';import {doc,onSnapshot} from 'firebase/firestore';import {onAuthStateChanged} from 'firebase/auth';
import {auth,db} from '../lib/firebase';import {startTrackingObserver,type ObservedTracking} from './trackingObserver';
export function useOrderTracking(orderId:string,orderStatus:string,enabled=true,merchant=false){
 const [uid,setUid]=useState(auth.currentUser?.uid);
 const key=JSON.stringify([uid,orderId,orderStatus,enabled,merchant]);
 const initial:ObservedTracking={status:orderStatus==='delivered'?'delivered':orderStatus==='cancelled'?'cancelled':'waiting',point:null,lastArrivalAt:null};
 const [snapshot,setSnapshot]=useState<{key:string;state:ObservedTracking}>({key,state:initial});
 const setState=(state:ObservedTracking)=>setSnapshot({key,state});
 useEffect(()=>onAuthStateChanged(auth,user=>setUid(user?.uid)),[]);
 useEffect(()=>{
  setState({status:orderStatus==='delivered'?'delivered':orderStatus==='cancelled'?'cancelled':'waiting',point:null,lastArrivalAt:null});
  if(!enabled||!uid||!orderId||orderStatus!=='with_courier')return;
  return startTrackingObserver({orderStatus,notify:setState,listen:(data,error)=>merchant?listenMerchantTracking(orderId,data,error,{hidden:()=>document.hidden,request:async(id,signal)=>{const token=await auth.currentUser?.getIdToken();if(!token)throw Error('login');const res=await fetch(apiUrl('/api/operations'),{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'merchant-tracking',orderId:id})});if(!res.ok)throw Error('tracking');return res.json();}}):onSnapshot(doc(db,'tracking',orderId),{includeMetadataChanges:true},s=>data(s.exists()?s.data():null,s.metadata.fromCache),error)});
 },[uid,enabled,orderId,orderStatus,merchant]);
 return snapshot.key===key?snapshot.state:initial;
}
