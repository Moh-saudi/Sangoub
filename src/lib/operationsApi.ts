import { auth } from './firebase';
import { apiUrl } from './apiUrl';
export async function operationsApi(endpoint: 'operations' | 'app-content', body: object) {
 const user = auth.currentUser; if (!user) throw new Error('يرجى تسجيل الدخول.');
 const response = await fetch(apiUrl('/api/' + endpoint), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify(body) });
 const result = await response.json().catch(() => ({ error: 'الخدمة غير متاحة حاليًا.' }));
 if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ العملية.');
 return result;
}
