import { apiUrl } from './apiUrl';

export async function submitPartnerApplication(payload: Record<string, unknown>) {
  const response=await fetch(apiUrl('/api/partner-application'),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'تعذر إرسال طلب الشراكة.');
  return result;
}
