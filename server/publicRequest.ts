import { AdminError } from './adminRequest.ts';
/** Same-origin browser JSON writes never grant authenticated data access. */
export function requireSameOriginJson(req: any) {
 let valid = false;
 try { const url = new URL(req.headers.origin); valid = ['http:', 'https:'].includes(url.protocol) && url.host === req.headers.host; } catch { /* Reject missing origins. */ }
 if (!valid || req.headers['sec-fetch-site'] === 'cross-site') throw new AdminError(403, 'مصدر الطلب غير مسموح.');
 if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AdminError(415, 'استخدم JSON.');
}
