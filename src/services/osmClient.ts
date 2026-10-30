import { apiUrl } from '../lib/apiUrl';
export interface OsmClientOptions { fetch?:typeof fetch; getToken?:()=>Promise<string>; signal?:AbortSignal }
/** Same-origin only: never send Firebase tokens to configurable upstream providers. */
export async function requestOsm(action:'route'|'search',body:object,options:OsmClientOptions={}){
 const token = action === 'search' ? undefined : await (options.getToken?options.getToken():(async()=>{const {auth}=await import('../lib/firebase');const token=await auth.currentUser?.getIdToken();if(!token)throw Error('سجل الدخول لاستخدام المسار.');return token})());
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 const response=await (options.fetch||fetch)(apiUrl('/api/osm/'+action),{method:'POST',signal:options.signal,headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},body:JSON.stringify(body)});
 const result=await response.json().catch(()=>({error:'خدمة الخرائط غير متاحة.'}));
 if(!response.ok)throw Object.assign(new Error(result.error||'خدمة الخرائط غير متاحة.'),{status:response.status});return result;
}
export async function searchOsm(body:{query?:string;coordinates?:{latitude:number;longitude:number}},options:OsmClientOptions={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
 const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
 if(options.signal?.aborted)controller.abort();
 try{return await requestOsm('search',body,{...options,signal:controller.signal});}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
