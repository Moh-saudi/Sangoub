import {useEffect,useState} from 'react';import {doc,onSnapshot} from 'firebase/firestore';import {onAuthStateChanged} from 'firebase/auth';
import {auth,db} from '../lib/firebase';import {startTrackingObserver,type ObservedTracking} from './trackingObserver';
export function useOrderTracking(orderId:string,orderStatus:string,enabled=true){
 const [uid,setUid]=useState(auth.currentUser?.uid),[state,setState]=useState<ObservedTracking>({status:'waiting',point:null,lastArrivalAt:null});
 useEffect(()=>onAuthStateChanged(auth,user=>setUid(user?.uid)),[]);
 useEffect(()=>{
  setState({status:orderStatus==='delivered'?'delivered':orderStatus==='cancelled'?'cancelled':'waiting',point:null,lastArrivalAt:null});
  if(!enabled||!uid||!orderId||orderStatus!=='with_courier')return;
  return startTrackingObserver({orderStatus,notify:setState,listen:(data,error)=>onSnapshot(doc(db,'tracking',orderId),{includeMetadataChanges:true},s=>data(s.exists()?s.data():null,s.metadata.fromCache),error)});
 },[uid,enabled,orderId,orderStatus]);
 return state;
}
