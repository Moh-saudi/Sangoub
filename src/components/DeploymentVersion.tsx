import { useEffect, useState } from 'react';
export function DeploymentVersion({publicSite=false}:{publicSite?:boolean}){
 const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!import.meta.env.PROD)return;
  let active=true;
  const check=async()=>{if(document.hidden)return;try{const response=await fetch('/build-info.json?check='+Date.now(),{cache:'no-store'});if(!response.ok)return;const info=await response.json();if(active&&typeof info.id==='string'&&info.id!==import.meta.env.VITE_BUILD_ID)setAvailable(true);}catch{}if('serviceWorker'in navigator){navigator.serviceWorker.getRegistration().then(reg=>reg?.update()).catch(()=>{});}};
  void check();const timer=setInterval(check,60000);document.addEventListener('visibilitychange',check);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',check);};
 },[]);
 async function refresh(){setBusy(true);try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration();if(registration){await registration.update();registration.waiting?.postMessage({type:'SKIP_WAITING'});const worker=registration.installing||registration.waiting;if(worker)await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timeout);worker.removeEventListener('statechange',changed);resolve();};const changed=()=>{if(worker.state==='activated'||worker.state==='redundant')done();};const timeout=setTimeout(done,5000);worker.addEventListener('statechange',changed);changed();});}}}catch{}window.location.reload();}
 return available?<div className={publicSite?"site-version-notice":"admin-version-notice"} role="status"><span>{publicSite?"حدّث الصفحة لعرض أحدث تصميم للموقع.":"نسخة جديدة من لوحة الإدارة متاحة. احفظ تغييراتك ثم حدّث الصفحة."}</span><button disabled={busy} onClick={refresh}>{busy?'جارٍ التحديث…':'تحميل النسخة الجديدة'}</button></div>:null;
}
