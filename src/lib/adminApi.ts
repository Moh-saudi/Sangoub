import { auth } from './firebase';
import { apiUrl } from './apiUrl';
export async function adminApi(endpoint:'users'|'data',body:object){
  const user=auth.currentUser;if(!user)throw new Error('يرجى تسجيل الدخول.');
  const response=await fetch(apiUrl('/api/admin-'+endpoint),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({error:'خدمة الإدارة غير متاحة حاليًا. يرجى المحاولة لاحقًا.'}));
  if(!response.ok)throw new Error((result.error||'تعذر تنفيذ العملية.')+(typeof result.incidentId==='string'?' · معرّف الخطأ: '+result.incidentId.slice(0,80):''));return result;
}
