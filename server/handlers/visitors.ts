import { createHash } from 'node:crypto';
import { requireSameOriginJson } from '../publicRequest.ts';
import { visitorEvents, visitorSources } from '../../src/types/siteAnalytics.ts';
import { requireAdmin, adminError, AdminError } from '../adminRequest.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';

export function cairoVisitorDay(now = new Date()) {
 return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export default async function handler(req: any, res: any) {
 res.setHeader('Cache-Control', 'no-store');
 try {
  const client = supabaseAdminClient();
  if (req.method === 'GET') {
   await requireAdmin(req);
   const day = cairoVisitorDay();
   const keys = Array.from({ length: 7 }, (_, index) => cairoVisitorDay(new Date(Date.parse(day + 'T12:00:00Z') - (6 - index) * 86400000)));
   const [{ data: totals, error: totalsError }, { data: records, error: daysError }] = await Promise.all([
    client.from('site_visitor_totals').select('visitors,started_at,analytics_started_at').eq('id', true).maybeSingle(),
    client.from('site_visitor_days').select('day,visitors,sources,events').in('day', keys),
   ]);
   if (totalsError || daysError) throw new AdminError(503, 'تعذر تحميل إحصائيات الزوار من Supabase.');
   const byDay = new Map((records || []).map((record: any) => [String(record.day).slice(0, 10), record]));
   const days = keys.map(key => {
    const record: any = byDay.get(key);
    return { day: key, visitors: Number(record?.visitors) || 0, sources: record?.sources || {}, events: record?.events || {} };
   });
   return res.status(200).json({ total: Number(totals?.visitors) || 0, today: days[6].visitors, day: days[6].day, days, startedAt: totals?.started_at || null, analyticsStartedAt: totals?.analytics_started_at || null });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  requireSameOriginJson(req);
  const input = req.body;
  if (!input || Object.keys(input).some(key => !['visitorId', 'source', 'event'].includes(key)) || typeof input.visitorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.visitorId)) throw new AdminError(400, 'معرّف الزيارة غير صالح.');
  if (input.source !== undefined && !visitorSources.includes(input.source) || input.event !== undefined && !visitorEvents.includes(input.event)) throw new AdminError(400, 'نوع الإحصائية غير صالح.');
  if (/bot\b|crawler|spider|facebookexternalhit|WhatsApp|HeadlessChrome/i.test(req.headers['user-agent'] || '')) return res.status(200).json({ ok: true });
  const visitorHash = createHash('sha256').update(input.visitorId.toLowerCase()).digest('hex');
  const { error } = await client.rpc('record_sangoub_site_visit', {
   p_hash: visitorHash, p_day: cairoVisitorDay(), p_source: input.source || 'direct', p_event: input.event || null,
  });
  if (error) throw new AdminError(503, 'تعذر تسجيل الزيارة في Supabase.');
  return res.status(200).json({ ok: true });
 } catch (error) { return adminError(res, error); }
}
