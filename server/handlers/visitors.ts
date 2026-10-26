import { requireSameOriginJson } from '../publicRequest.ts';
import { visitorEvents, visitorSources } from '../../src/types/siteAnalytics.ts';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminServices } from '../firebaseAdmin.ts';
import { requireAdmin, adminError, AdminError } from '../adminRequest.ts';

export function cairoVisitorDay(now = new Date()) {
 return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export default async function handler(req: any, res: any) {
 res.setHeader('Cache-Control', 'no-store');
 try {
  if (req.method === 'GET') {
   const { db } = await requireAdmin(req);
   const day = cairoVisitorDay();
   const keys = Array.from({ length: 7 }, (_, index) => cairoVisitorDay(new Date(Date.parse(day + 'T12:00:00Z') - (6 - index) * 86400000)));
   const [summary, ...snapshots] = await db.getAll(db.doc('siteMetrics/summary'), ...keys.map(key => db.doc('siteMetricDays/' + key)));
   const days = snapshots.map((snapshot, index) => ({ day: keys[index], visitors: snapshot.data()?.visitors || 0, sources: snapshot.data()?.sources || {}, events: snapshot.data()?.events || {} }));
   return res.status(200).json({ total: summary.data()?.visitors || 0, today: days[6].visitors, day, days, startedAt: summary.data()?.startedAt?.toDate?.().toISOString() || null, analyticsStartedAt: summary.data()?.analyticsStartedAt?.toDate?.().toISOString() || null });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Browser-only, same-origin JSON endpoint; no public counter reads or CORS access.
  requireSameOriginJson(req);
  const input = req.body;
  if (!input || Object.keys(input).some(key => !['visitorId', 'source', 'event'].includes(key)) || typeof input.visitorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.visitorId)) throw new AdminError(400, 'معرّف الزيارة غير صالح.');
  if (input.source !== undefined && !visitorSources.includes(input.source) || input.event !== undefined && !visitorEvents.includes(input.event)) throw new AdminError(400, 'نوع الإحصائية غير صالح.');
  if (/bot\b|crawler|spider|facebookexternalhit|WhatsApp|HeadlessChrome/i.test(req.headers['user-agent'] || '')) return res.status(200).json({ ok: true });
  const { db } = adminServices();
  const day = cairoVisitorDay();
  const visitor = db.doc('siteVisitors/' + createHash('sha256').update(input.visitorId.toLowerCase()).digest('hex'));
  const summary = db.doc('siteMetrics/summary');
  await db.runTransaction(async tx => {
   const [previous, totals] = await Promise.all([tx.get(visitor), tx.get(summary)]);
   const old = previous.data(), sameDay = old?.lastDay === day;
   const events: string[] = sameDay && Array.isArray(old?.events) ? old.events : [];
   const newEvent = input.event && !events.includes(input.event);
   const source = input.source || 'direct';
   const newSource = !sameDay || !old?.source;
   if (sameDay && !newEvent && !newSource) return;
   tx.set(visitor, { lastDay: day, source: newSource ? source : old!.source, events: newEvent ? [...events, input.event] : events });
   const daily: Record<string, any> = {};
   if (!sameDay) daily.visitors = FieldValue.increment(1);
   if (newSource) daily.sources = { [source]: FieldValue.increment(1) };
   if (newEvent) daily.events = { [input.event]: FieldValue.increment(1) };
   tx.set(db.doc('siteMetricDays/' + day), daily, { merge: true });
   const totalsUpdate: Record<string, any> = {};
   if (!previous.exists) totalsUpdate.visitors = FieldValue.increment(1);
   if (!totals.exists) totalsUpdate.startedAt = FieldValue.serverTimestamp();
   if (!totals.data()?.analyticsStartedAt) totalsUpdate.analyticsStartedAt = FieldValue.serverTimestamp();
   if (Object.keys(totalsUpdate).length) tx.set(summary, totalsUpdate, { merge: true });
  });
  return res.status(200).json({ ok: true });
 } catch (error) { return adminError(res, error); }
}
