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
  const [{ data: totals, error: totalsErr }, { data: records, error: recordsErr }] = await Promise.all([
    supabase.from('site_visitor_totals').select('visitors,started_at,analytics_started_at').eq('id', true).maybeSingle(),
    supabase.from('site_visitor_days').select('day,visitors,sources,events').in('day', keys),
  ]);

  if (totalsErr || recordsErr) {
    const err = totalsErr || recordsErr;
    if (err?.code === '42501' || (err as any)?.status === 403 || err?.message?.includes('permission')) {
      throw new Error('PERMISSION_DENIED_ANALYTICS');
    }
    console.warn('Visitor stats direct query notice:', err);
  }

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

const FIX_SQL = `-- تفعيل صلاحية قراءة إحصائيات الزوار في Supabase SQL Editor
GRANT SELECT ON public.site_visitor_totals TO anon, authenticated;
GRANT SELECT ON public.site_visitor_days TO anon, authenticated;

DROP POLICY IF EXISTS "Allow select visitor totals" ON public.site_visitor_totals;
DROP POLICY IF EXISTS "Allow select visitor days" ON public.site_visitor_days;

CREATE POLICY "Allow select visitor totals" ON public.site_visitor_totals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow select visitor days" ON public.site_visitor_days FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.site_visitor_totals (id, visitors, started_at, analytics_started_at)
VALUES (true, 0, now(), now()) ON CONFLICT (id) DO NOTHING;
GRANT EXECUTE ON FUNCTION public.record_sangoub_site_visit(text, date, text, text) TO anon, authenticated;`;

export function VisitorStats() {
 const [stats, setStats] = useState<VisitorStatsData | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0), [copied, setCopied] = useState(''), [sqlCopied, setSqlCopied] = useState(false);
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
   } catch (e: any) {
     if (!controller.signal.aborted) {
       if (e?.message === 'PERMISSION_DENIED_ANALYTICS') {
         setError('PERMISSION_DENIED_ANALYTICS');
       } else {
         try {
           const direct = await fetchFromSupabaseDirect();
           setStats(direct);
         } catch (directErr: any) {
           if (directErr?.message === 'PERMISSION_DENIED_ANALYTICS') {
             setError('PERMISSION_DENIED_ANALYTICS');
           } else {
             setError('تعذر قراءة إحصائيات الزوار حالياً.');
           }
         }
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
  {error === 'PERMISSION_DENIED_ANALYTICS' ? (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-3 font-bold text-amber-950 mb-4" dir="rtl">
      <div className="flex items-center gap-2 text-amber-800">
        <span className="text-base">🔒</span>
        <span className="font-black text-sm">يتطلب عرض إحصائيات الزوار تفعيل صلاحية القراءة في Supabase</span>
      </div>
      <p className="font-normal text-amber-900 leading-relaxed">
        جداول إحصائيات الزوار (<code>site_visitor_totals</code> و <code>site_visitor_days</code>) مفعل عليها نظام الأمان، ولتمكين لوحة التحكم من قراءتها يرجى تشغيل سكريبت الصلاحيات لمرة واحدة في محرر SQL بـ Supabase.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(FIX_SQL);
              setSqlCopied(true);
              setTimeout(() => setSqlCopied(false), 3000);
            } catch {}
          }}
          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <span>{sqlCopied ? 'تم نسخ كود SQL بنجاح ✓' : 'نسخ كود تفعيل الصلاحيات (SQL) 📋'}</span>
        </button>
        <span className="text-[11px] text-amber-700 font-normal">الملف متوفر أيضاً في: <code>scripts/supabase_fix_analytics_permissions.sql</code></span>
      </div>
    </div>
  ) : error ? (
    <p role="alert" className="ops-warning">{error}</p>
  ) : null}
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
