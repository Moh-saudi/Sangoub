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
   const [summary, today] = await Promise.all([db.doc('siteMetrics/summary').get(), db.doc('siteMetricDays/' + day).get()]);
   return res.status(200).json({ total: summary.data()?.visitors || 0, today: today.data()?.visitors || 0, day, startedAt: summary.data()?.startedAt?.toDate?.().toISOString() || null });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Browser-only, same-origin JSON endpoint; no public counter reads or CORS access.
  const origin = req.headers.origin;
  const host = req.headers.host;
  let sameOrigin = false;
  try { const url = new URL(origin); sameOrigin = ['http:', 'https:'].includes(url.protocol) && url.host === host; } catch { /* Reject missing or malformed origins. */ }
  if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') throw new AdminError(403, 'مصدر الطلب غير مسموح.');
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AdminError(415, 'استخدم JSON.');
  const input = req.body;
  if (!input || Object.keys(input).length !== 1 || typeof input.visitorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.visitorId)) throw new AdminError(400, 'معرّف الزيارة غير صالح.');
  if (/bot\b|crawler|spider|facebookexternalhit|WhatsApp|HeadlessChrome/i.test(req.headers['user-agent'] || '')) return res.status(200).json({ ok: true });
  const { db } = adminServices();
  const day = cairoVisitorDay();
  const visitor = db.doc('siteVisitors/' + createHash('sha256').update(input.visitorId.toLowerCase()).digest('hex'));
  const summary = db.doc('siteMetrics/summary');
  await db.runTransaction(async tx => {
   const [previous, totals] = await Promise.all([tx.get(visitor), tx.get(summary)]);
   if (previous.data()?.lastDay === day) return;
   tx.set(visitor, { lastDay: day });
   tx.set(db.doc('siteMetricDays/' + day), { visitors: FieldValue.increment(1) }, { merge: true });
   if (!previous.exists) tx.set(summary, { visitors: FieldValue.increment(1), ...(!totals.exists ? { startedAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
  });
  return res.status(200).json({ ok: true });
 } catch (error) { return adminError(res, error); }
}
