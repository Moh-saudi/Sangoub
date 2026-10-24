import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { apiUrl } from '../lib/apiUrl';
type Stats = { total: number; today: number; day: string; startedAt: string | null };
export function VisitorStats() {
 const [stats, setStats] = useState<Stats | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
 useEffect(() => {
  const controller = new AbortController();setLoading(true);setError('');
  (async () => {
   try {
    const user = auth.currentUser;if (!user) throw new Error('يرجى تسجيل الدخول.');
    const response = await fetch(apiUrl('/api/visitors'), { headers: { Authorization: 'Bearer ' + await user.getIdToken() }, signal: controller.signal });
    const result = await response.json();if (!response.ok) throw new Error(result.error || 'تعذر تحميل الإحصائيات.');
    if (!controller.signal.aborted) setStats(result);
   } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
   finally { if (!controller.signal.aborted) setLoading(false); }
  })();
  return () => controller.abort();
 }, [revision]);
 const number = (value: number) => value.toLocaleString('ar-EG');
 return <section className="admin-panel" aria-labelledby="visitor-stats-title">
  <div className="admin-panel-heading"><div><h1 id="visitor-stats-title">عدد زوار الموقع</h1><p>عدد تقريبي للمتصفحات التي زارت الموقع، دون أسماء أو أرقام هواتف.</p></div><button className="btn btn-outline-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>تحديث العدد</button></div>
  {error && <p role="alert" className="ops-warning">{error}</p>}
  {loading && <p role="status">جارٍ تحميل العدد…</p>}
  {stats && !loading && !error && <><div className="management-summary" aria-live="polite"><span>إجمالي الزوار <strong>{number(stats.total)}</strong></span><span>زوار اليوم <strong>{number(stats.today)}</strong></span></div><p className="p-3 text-sm text-slate-600">اليوم بتوقيت القاهرة: {stats.day}{stats.startedAt ? ` · بدأ العدّ في ${new Date(stats.startedAt).toLocaleDateString('ar-EG', {timeZone:'Africa/Cairo'})}` : ' · يبدأ العدّ مع أول زيارة مسجلة.'}</p></>}
  <p className="p-3 text-sm text-slate-600">تحديث الصفحة من نفس المتصفح لا يزيد العدد في اليوم نفسه. استخدام جهاز آخر أو مسح بيانات المتصفح قد يحسب زائرًا جديدًا. الأعداد تبدأ بعد تفعيل العدّ ولا تشمل الزيارات السابقة أو تطبيق الموبايل.</p>
 </section>;
}
