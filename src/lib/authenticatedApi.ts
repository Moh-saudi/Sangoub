import { auth } from './firebase';
import { apiUrl } from './apiUrl';
/** One authenticated JSON transport for admin and operations actions; mutations are never retried automatically. */
export async function authenticatedApi(path: string, body: object) {
 const user=auth.currentUser;if(!user)throw new Error('يرجى تسجيل الدخول.');
 const response=await fetch(apiUrl(path),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body)});
 const result=await response.json().catch(()=>({error:'الخدمة غير متاحة حاليًا. يرجى المحاولة لاحقًا.'}));
 if(!response.ok)throw new Error((result.error||'تعذر تنفيذ العملية.')+(typeof result.incidentId==='string'?' · معرّف الخطأ: '+result.incidentId.slice(0,80):''));
 return result;
}
