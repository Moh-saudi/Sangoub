import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/apiUrl';
import { eventLabels, sourceLabels, visitorEvents, visitorSources, type VisitorStatsData } from '../types/siteAnalytics';

function cairoVisitorDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

async function fetchFromSupabaseDirect(): Promise<VisitorStatsData> {
  const day = cairoVisitorDay();
  const keys = Array.from({ length: 7 }, (_, index) => cairoVisitorDay(new Date(Date.parse(day + 'T12:00:00Z') - (6 - index) * 86400000)));
  const [{ data: totals }, { data: records }] = await Promise.all([
    supabase.from('site_visitor_totals').select('visitors,started_at,analytics_started_at').eq('id', true).maybeSingle(),
    supabase.from('site_visitor_days').select('day,visitors,sources,events').in('day', keys),
  ]);
  const byDay = new Map((records || []).map((record: any) => [String(record.day).slice(0, 10), record]));
  const days = keys.map(key => {
    const record: any = byDay.get(key);
    return { day: key, visitors: Number(record?.visitors) || 0, sources: record?.sources || {}, events: record?.events || {} };
  });
  return {
    total: Number(totals?.visitors) || 0,
    today: days[6]?.visitors || 0,
    day: days[6]?.day || day,
    days,
    startedAt: totals?.started_at || null,
    analyticsStartedAt: totals?.analytics_started_at || null
  };
}

export function VisitorStats() {
 const [stats, setStats] = useState<VisitorStatsData | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0), [copied, setCopied] = useState('');
 useEffect(() => {
  const controller = new AbortController();setLoading(true);setError('');
  (async () => {
   try {
    const { data: { session } } = await supabase.auth.getSession();
    let data: VisitorStatsData | null = null;
    try {
      if (session?.access_token) {
        const response = await fetch(apiUrl('/api/visitors'), { headers: { Authorization: 'Bearer ' + session.access_token }, signal: controller.signal });
        const text = await response.text();
        if (response.ok && text.trim().startsWith('{')) {
          data = JSON.parse(text);
        }
      }
    } catch {}

    if (!data) {
      data = await fetchFromSupabaseDirect();
    }

    if (!controller.signal.aborted && data) setStats(data);
   } catch (e) {
     if (!controller.signal.aborted) {
       try {
         const direct = await fetchFromSupabaseDirect();
         setStats(direct);
       } catch {
         setError('تعذر قراءة إحصائيات الزوار حالياً.');
       }
     }
   }
   finally { if (!controller.signal.aborted) setLoading(false); }
  })();
  return () => controller.abort();
 }, [revision]);
 const number = (value: number) => value.toLocaleString('ar-EG');
 const days = stats?.days || [], weekVisits = days.reduce((sum, day) => sum + day.visitors, 0);
 const eventCount = (event: typeof visitorEvents[number]) => days.reduce((sum, day) => sum + (day.events[event] || 0), 0);
 const rate = (count: number) => weekVisits ? (count / weekVisits * 100).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + '٪' : '—';
 const sourceRows = visitorSources.map(source => ({source, count: days.reduce((sum, day) => sum + (day.sources[source] || 0), 0)}));
 const unknown = Math.max(0, weekVisits - sourceRows.reduce((sum, row) => sum + row.count, 0));
 const max = Math.max(1, ...days.map(day => day.visitors));
 const link = (source: string) => { const url = new URL('/', window.location.origin);url.searchParams.set('utm_source', source);return url.href; };
 async function copy(source: string) { try { await navigator.clipboard.writeText(link(source));setCopied(source); } catch { setCopied('error'); } }
 return <section className="admin-panel visitor-stats" aria-labelledby="visitor-stats-title">
  <div className="admin-panel-heading"><div><h1 id="visitor-stats-title">عدد زوار الموقع</h1><p>الزيارات والتفاعل مع سنجوب، دون أسماء أو أرقام هواتف.</p></div><button className="btn btn-outline-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>تحديث العدد</button></div>
  {error && <p role="alert" className="ops-warning">{error}</p>}
  {loading && <p role="status">جارٍ تحميل العدد…</p>}
  {stats && !loading && !error && <>
   <div className="management-summary" aria-live="polite"><span>إجمالي الزوار <strong>{number(stats.total)}</strong></span><span>زوار اليوم <strong>{number(stats.today)}</strong></span></div>
   <p className="visitor-note">اليوم بتوقيت القاهرة: <bdi>{stats.day}</bdi>{stats.startedAt ? ` · بدأ عدّ الزوار في ${new Date(stats.startedAt).toLocaleDateString('ar-EG', {timeZone:'Africa/Cairo'})}` : ' · يبدأ العدّ مع أول زيارة.'}</p>
   <div className="visitor-grid">
    <section className="visitor-card"><h2>آخر ٧ أيام</h2><p>يشمل اليوم · مجموع الأعداد اليومية: {number(weekVisits)}</p><ul className="visitor-days">{days.map(day => <li key={day.day}><time dateTime={day.day}>{new Date(day.day + 'T12:00:00Z').toLocaleDateString('ar-EG', {timeZone:'Africa/Cairo',weekday:'short',day:'numeric',month:'numeric'})}</time><span className="visitor-bar" aria-hidden="true"><i style={{width:(day.visitors/max*100)+'%'}} /></span><strong>{number(day.visitors)}</strong></li>)}</ul><p>قد يتكرر نفس المتصفح في أيام مختلفة؛ المجموع ليس عدد أشخاص فريدًا خلال الأسبوع.</p></section>
    <section className="visitor-card"><h2>مصادر الزيارات · آخر ٧ أيام</h2><p>مصدر أول زيارة للمتصفح في كل يوم.</p><ul className="visitor-count-list">{sourceRows.sort((a,b)=>b.count-a.count).map(row=><li key={row.source}><span>{sourceLabels[row.source]}</span><strong>{number(row.count)}</strong></li>)}{unknown>0&&<li><span>زيارات قبل تصنيف المصادر</span><strong>{number(unknown)}</strong></li>}</ul><p>قد لا يرسل فيسبوك أو واتساب مصدر الدخول؛ استخدم روابط المشاركة أدناه لدقة أفضل.</p></section>
    <section className="visitor-card"><h2>التفاعل مع سنجوب · آخر ٧ أيام</h2><p>كل إجراء يُحسب مرة واحدة لكل متصفح في اليوم.</p><div className="admin-table-scroll"><table className="admin-data-table table"><thead><tr><th>الإجراء</th><th>العدد</th><th>من زوار الفترة</th></tr></thead><tbody>{visitorEvents.map(event=><tr key={event}><td>{eventLabels[event]}</td><td>{number(eventCount(event))}</td><td>{rate(eventCount(event))}</td></tr>)}</tbody></table></div><p>الضغط على واتساب خطوة تواصل، وليس إثبات إرسال الرسالة أو تأكيد طلب. يمكن للزائر اختيار الخدمتين؛ لا تجمع نسب الصفوف.</p></section>
    <section className="visitor-card"><h2>روابط قياس البوستات</h2><p>انشر الرابط المناسب لنعرف مصدر الزيارات حتى لو لم يرسله المتصفح.</p>{(['facebook','whatsapp'] as const).map(source=><label className="visitor-share" key={source}>{sourceLabels[source]}<input aria-label={`رابط قياس ${sourceLabels[source]}`} dir="ltr" readOnly value={link(source)} /><button className="btn btn-outline-secondary" onClick={()=>void copy(source)}>{copied===source?'تم النسخ':`نسخ رابط ${sourceLabels[source]}`}</button></label>)}<span role="status">{copied==='error'?'تعذر النسخ التلقائي؛ حدد الرابط وانسخه يدويًا.':copied?'تم نسخ رابط المشاركة.':''}</span><p>{stats.analyticsStartedAt?`بدأ تسجيل المصادر والتفاعل في ${new Date(stats.analyticsStartedAt).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'})}.`:'تظهر بيانات المصادر والتفاعل مع أول زيارة بعد التحديث.'} لا تُسترجع التفاعلات السابقة.</p></section>
   </div>
  </>}
  <p className="visitor-note">الأعداد تقريبية لكل متصفح. استخدام جهاز آخر أو مسح بيانات المتصفح قد يحسب زائرًا جديدًا. لا تشمل هذه الإحصائيات تطبيق الموبايل.</p>
 </section>;
}
