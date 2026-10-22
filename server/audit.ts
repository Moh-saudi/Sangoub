import { randomUUID } from "node:crypto";
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';

export function attachAuditContext(req: any, actor: DecodedIdToken) {
  actor.auditContext = { requestId: randomUUID(), userAgent: String(req.headers['user-agent'] || '').slice(0,300), ip: String(process.env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] || '' : req.socket?.remoteAddress || '').split(',')[0].trim().slice(0,80) };
}
const privateField = /password|token|secret|otp|authorization|credential|privatekey|uploadurl|resetlink/i;
export function auditSafe(value: any, depth = 0): any {
  if (depth > 8) return '[truncated]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value ?? null;
  if (typeof value === 'string') return value.slice(0, 2000);
  if (value.constructor?.name === 'ServerTimestampTransform') return '[server timestamp]';
  if (value.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map(item => auditSafe(item, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !privateField.test(key)).slice(0, 100).map(([key, item]) => [key, auditSafe(item, depth + 1)]));
  return null;
}
export function auditChangedFields(before: any, after: any): string[] {
  const changes: string[] = [];
  function walk(old: any, next: any, prefix: string) {
    if(changes.length >= 200 || JSON.stringify(old) === JSON.stringify(next)) return;
    if(old && next && typeof old === 'object' && typeof next === 'object' && !Array.isArray(old) && !Array.isArray(next)) {
      for(const key of new Set([...Object.keys(old),...Object.keys(next)])) walk(old[key],next[key],prefix ? prefix+'.'+key : key);
    } else changes.push(prefix || 'record');
  }
  walk(auditSafe(before),auditSafe(after),'');
  return changes;
}
export function auditRecord(actor: Pick<DecodedIdToken,'uid'|'email'>, action: string, entityType: string, entityId: string, before: any, after: any, reason = '') {
  const old = auditSafe(before), next = auditSafe(after);
  return { actorUid: actor.uid, actorEmail: actor.email || '', action, entityType, entityId, before: old, after: next,
    changedFields: auditChangedFields(old,next),
    request: auditSafe((actor as any).auditContext || {}), reason: reason.slice(0, 500), createdAt: FieldValue.serverTimestamp(), source: 'admin-api', status: 'success' };
}
export function auditInTransaction(db: Firestore, tx: Transaction, actor: Pick<DecodedIdToken,'uid'|'email'>, action: string, type: string, id: string, before: any, after: any, reason = '', source = 'admin-api') {
  tx.create(db.collection('auditLogs').doc(), {...auditRecord(actor, action, type, id, before, after, reason),source});
}
