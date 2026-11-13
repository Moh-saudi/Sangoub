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
    if (err?.code === '42P01' || err?.message?.includes('does not exist') || err?.message?.includes('not found')) {
      throw new Error('TABLES_NOT_FOUND_ANALYTICS');
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

const FIX_SQL = `-- 1. إنشاء جداول إحصائيات زوار سنجوب
CREATE TABLE IF NOT EXISTS public.site_visitors (
  visitor_hash text PRIMARY KEY CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  last_day date NOT NULL,
  source text NOT NULL DEFAULT 'direct',
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visitor_days (
  day date PRIMARY KEY,
  visitors bigint NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  events jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.site_visitor_totals (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  visitors bigint NOT NULL DEFAULT 0,
  started_at timestamptz,
  analytics_started_at timestamptz
);

-- 2. تفعيل نظام الأمان وصلاحيات القراءة للوحة التحكم
ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_totals ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_visitor_totals TO anon, authenticated;
GRANT SELECT ON public.site_visitor_days TO anon, authenticated;

DROP POLICY IF EXISTS "Allow select visitor totals" ON public.site_visitor_totals;
DROP POLICY IF EXISTS "Allow select visitor days" ON public.site_visitor_days;

CREATE POLICY "Allow select visitor totals" ON public.site_visitor_totals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow select visitor days" ON public.site_visitor_days FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.site_visitor_totals (id, visitors, started_at, analytics_started_at)
VALUES (true, 0, now(), now()) ON CONFLICT (id) DO NOTHING;

-- 3. دالة تسجيل الزيارة المشفرة
CREATE OR REPLACE FUNCTION public.record_sangoub_site_visit(p_hash text, p_day date, p_source text, p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.site_visitors%ROWTYPE; v_exists boolean; v_same boolean; v_new_source boolean; v_new_event boolean; v_new_visitor boolean;
BEGIN
  IF p_hash !~ '^[a-f0-9]{64}$' OR p_source NOT IN ('facebook','whatsapp','instagram','search','other','direct')
    OR (p_event IS NOT NULL AND p_event NOT IN ('mascot_open','breakfast','supermarket','review_breakfast','review_supermarket','whatsapp_breakfast','whatsapp_supermarket','whatsapp_support')) THEN
    RAISE EXCEPTION 'INVALID_SITE_VISIT' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.site_visitor_totals(id,visitors,started_at,analytics_started_at)
  VALUES(true,0,now(),now()) ON CONFLICT(id) DO NOTHING;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_hash,0));
  SELECT * INTO v_old FROM public.site_visitors WHERE visitor_hash=p_hash FOR UPDATE;
  v_exists := FOUND;
  v_new_visitor := NOT v_exists;
  v_same := v_exists AND v_old.last_day=p_day;
  v_new_source := NOT v_same OR NULLIF(v_old.source,'') IS NULL;
  v_new_event := p_event IS NOT NULL AND (NOT v_same OR NOT (v_old.events ? p_event));
  IF NOT v_same OR v_new_source OR v_new_event THEN
    INSERT INTO public.site_visitors(visitor_hash,last_day,source,events)
    VALUES(p_hash,p_day,p_source,CASE WHEN p_event IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p_event) END)
    ON CONFLICT(visitor_hash) DO UPDATE SET last_day=EXCLUDED.last_day,
      source=CASE WHEN v_new_source THEN p_source ELSE public.site_visitors.source END,
      events=CASE WHEN v_same AND p_event IS NOT NULL AND v_new_event THEN public.site_visitors.events || jsonb_build_array(p_event)
        WHEN NOT v_same AND p_event IS NOT NULL THEN jsonb_build_array(p_event)
        WHEN NOT v_same THEN '[]'::jsonb ELSE public.site_visitors.events END;
    INSERT INTO public.site_visitor_days(day,visitors,sources,events)
    VALUES(p_day,CASE WHEN v_same THEN 0 ELSE 1 END,
      CASE WHEN v_new_source THEN jsonb_build_object(p_source,1) ELSE '{}'::jsonb END,
      CASE WHEN v_new_event THEN jsonb_build_object(p_event,1) ELSE '{}'::jsonb END)
    ON CONFLICT(day) DO UPDATE SET
      visitors=public.site_visitor_days.visitors+EXCLUDED.visitors,
      sources=CASE WHEN v_new_source THEN jsonb_set(public.site_visitor_days.sources,ARRAY[p_source],to_jsonb(COALESCE((public.site_visitor_days.sources->>p_source)::bigint,0)+1),true) ELSE public.site_visitor_days.sources END,
      events=CASE WHEN v_new_event THEN jsonb_set(public.site_visitor_days.events,ARRAY[p_event],to_jsonb(COALESCE((public.site_visitor_days.events->>p_event)::bigint,0)+1),true) ELSE public.site_visitor_days.events END;
  END IF;
  IF v_new_visitor THEN UPDATE public.site_visitor_totals SET visitors=visitors+1 WHERE id=true; END IF;
  UPDATE public.site_visitor_totals SET analytics_started_at=COALESCE(analytics_started_at,now()),started_at=COALESCE(started_at,now()) WHERE id=true;
END $$;

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
       if (e?.message === 'PERMISSION_DENIED_ANALYTICS' || e?.message === 'TABLES_NOT_FOUND_ANALYTICS') {
         setError(e.message);
       } else {
         try {
           const direct = await fetchFromSupabaseDirect();
           setStats(direct);
         } catch (directErr: any) {
           if (directErr?.message === 'PERMISSION_DENIED_ANALYTICS' || directErr?.message === 'TABLES_NOT_FOUND_ANALYTICS') {
             setError(directErr.message);
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
  {error === 'PERMISSION_DENIED_ANALYTICS' || error === 'TABLES_NOT_FOUND_ANALYTICS' ? (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-3 font-bold text-amber-950 mb-4" dir="rtl">
      <div className="flex items-center gap-2 text-amber-800">
        <span className="text-base">🔒</span>
        <span className="font-black text-sm">
          {error === 'TABLES_NOT_FOUND_ANALYTICS'
            ? 'تنبيه: جداول إحصائيات الزوار غير منشأة في Supabase بعد'
            : 'يتطلب عرض إحصائيات الزوار تفعيل صلاحية القراءة في Supabase'}
        </span>
      </div>
      <p className="font-normal text-amber-900 leading-relaxed">
        {error === 'TABLES_NOT_FOUND_ANALYTICS'
          ? 'لبدء جمع إحصائيات الزوار وعرضها في لوحة التحكم، يرجى تشغيل سكريبت الإحصائيات أدناه لمرة واحدة في محرر SQL بـ Supabase.'
          : 'جداول إحصائيات الزوار (site_visitor_totals و site_visitor_days) مفعل عليها نظام الأمان، ولتمكين لوحة التحكم من قراءتها يرجى تشغيل سكريبت الصلاحيات لمرة واحدة في محرر SQL بـ Supabase.'}
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
          <span>{sqlCopied ? 'تم نسخ كود SQL بنجاح ✓' : 'نسخ كود إنشاء الجداول وتفعيل الصلاحيات (SQL) 📋'}</span>
        </button>
        <span className="text-[11px] text-amber-700 font-normal">الملف متوفر أيضاً في: <code>scripts/supabase_analytics_v1.sql</code></span>
      </div>
    </div>
  ) : error ? (
    <p role="alert" className="ops-warning">{error}</p>
  ) : null}
  {loading && <p role="status">جارٍ تحميل العدد…</p>}
  {stats && !loading && !error && <>
   {stats.total === 0 && (
     <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium mb-3" dir="rtl">
       ℹ️ تم تفعيل عداد الزوار في واجهة المتجر بنجاح. سيبدأ رصد الإحصائيات فور تصفح الزوار للموقع.
     </div>
   )}
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
