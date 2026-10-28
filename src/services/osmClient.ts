export interface OsmClientOptions { fetch?:typeof fetch; getToken?:()=>Promise<string>; signal?:AbortSignal }
/** Same-origin only: never send Firebase tokens to configurable upstream providers. */
export async function requestOsm(action:'route'|'search',body:object,options:OsmClientOptions={}){
 const token=await (options.getToken?options.getToken():(async()=>{const {auth}=await import('../lib/firebase');const token=await auth.currentUser?.getIdToken();if(!token)throw Error('سجل الدخول للبحث والمسار.');return token})());
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 const response=await (options.fetch||fetch)('/api/osm/'+action,{method:'POST',signal:options.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
 if(!response.ok)throw Error('خدمة الخرائط غير متاحة.');return response.json();
}
export async function searchOsm(body:{query?:string;coordinates?:{latitude:number;longitude:number}},options:OsmClientOptions={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
 const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
 try{return await requestOsm('search',body,{...options,signal:controller.signal});}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
