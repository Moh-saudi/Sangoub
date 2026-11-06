import { createHash } from 'node:crypto';
import { AdminError, adminError, type requireAdmin } from './adminRequest.ts';
import { requireSameOriginJson } from './publicRequest.ts';
import { buildBreakfastMessage, breakfastLines, breakfastCount, requestMenu, normalizeRequestPhone, type BreakfastDraft } from '../src/utils/breakfastOrder.ts';
import { requestStatuses } from '../src/types/sangoubRequest.ts';
import { supabaseAdminClient } from './supabaseAdmin.ts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const requestIdPattern = /^SNG-[a-f0-9-]{36}$/;

export async function submitSangoubRequest(req: any, res: any) {
 try {
  requireSameOriginJson(req);
  const input = req.body;
  if (!input || Object.keys(input).some(key => !['action','id','kind','draft'].includes(key)) || typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) || !['breakfast','supermarket'].includes(input.kind)) throw new AdminError(400,'بيانات الطلب غير صالحة.');
  const d = input.draft;
  if (!d || Object.keys(d).some(key => !['quantities','name','phone','address','office','notes','payment'].includes(key)) || !d.quantities || typeof d.quantities !== 'object' || Array.isArray(d.quantities) || Object.keys(d.quantities).length > 60 || typeof d.phone !== 'string' || d.phone.length > 30 || ['name','phone','address','office','notes','payment'].some(key => typeof d[key] !== 'string')) throw new AdminError(400,'راجع بيانات الطلب.');
  let draft: BreakfastDraft;
  try { draft = { ...d, phone: normalizeRequestPhone(d.phone), name: d.name.trim(), address: d.address.trim(), office: d.office.trim(), notes: d.notes.trim() }; buildBreakfastMessage(draft, requestMenu(input.kind)); }
  catch (e) { throw new AdminError(400,(e as Error).message); }
  const items = breakfastLines(draft.quantities,requestMenu(input.kind));
  const data = { kind: input.kind, name: draft.name, phone: draft.phone, address: draft.address, office: draft.office, notes: draft.notes, payment: draft.payment, items, totalQuantity: breakfastCount(draft.quantities,requestMenu(input.kind)) };
  const fingerprint = hash(JSON.stringify(data));
  const client = supabaseAdminClient();
  const { error } = await client.rpc('create_sangoub_request', {
   p_id: 'SNG-' + input.id.toLowerCase(), p_kind: input.kind, p_data: data, p_fingerprint: fingerprint, p_phone_hash: hash(draft.phone!),
  });
  if (error) {
   if (error.message?.includes('SANGOUB_REQUEST_CONFLICT')) throw new AdminError(409,'تغيرت بيانات الطلب؛ راجع الطلب وأعد المحاولة.');
   if (error.message?.includes('SANGOUB_REQUEST_RATE_LIMIT')) throw new AdminError(429,'بلغت الحد اليومي للطلبات. تواصل مع الدعم.');
   throw new AdminError(503,'تعذر تسجيل الطلب في Supabase.');
  }
  return res.status(200).json({ id: 'SNG-' + input.id.toLowerCase() });
 } catch (e) { return adminError(res,e); }
}

export async function adminSangoubRequests(input: any, context: { actor: { uid: string } }) {
 const { actor } = context;
 const allowed = input.action === 'sangoub-list' ? ['action','cursor'] : ['action','id','status','note','expectedStatus','expectedVersion'];
 if (Object.keys(input).some(key => !allowed.includes(key))) throw new AdminError(400,'حقول متابعة غير صالحة.');
 const client = supabaseAdminClient();
 if (input.action === 'sangoub-list') {
  let query = client.from('sangoub_requests').select('id,kind,name,phone,address,office,notes,payment,items,total_quantity,status,version,admin_note,source,created_at,updated_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(26);
  if (input.cursor) {
   if (typeof input.cursor !== 'string' || !requestIdPattern.test(input.cursor)) throw new AdminError(400,'مؤشر غير صالح.');
   const { data: cursor, error: cursorError } = await client.from('sangoub_requests').select('id,created_at').eq('id',input.cursor).maybeSingle();
   if (cursorError || !cursor) throw new AdminError(400,'مؤشر غير صالح.');
   const createdAt = new Date(cursor.created_at).toISOString();
   query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${input.cursor})`);
  }
  const { data, error } = await query;
  if (error) throw new AdminError(503,'تعذر تحميل الطلبات من Supabase.');
  const rows = data || [], docs = rows.slice(0,25);
  return { requests: docs.map((row: any) => ({ id: row.id, kind: row.kind, name: row.name, phone: row.phone, address: row.address, office: row.office, notes: row.notes, payment: row.payment, items: row.items, totalQuantity: row.total_quantity, status: row.status, version: row.version, adminNote: row.admin_note, source: row.source, createdAt: row.created_at, updatedAt: row.updated_at })), nextCursor: rows.length > 25 ? docs.at(-1)?.id || null : null };
 }
 if (!requestIdPattern.test(input.id || '') || !requestStatuses.includes(input.status) || !requestStatuses.includes(input.expectedStatus) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || typeof input.note !== 'string' || input.note.length > 500 || !input.note.trim()) throw new AdminError(400,'اختر الحالة واكتب ملاحظة المتابعة.');
 const { error } = await client.rpc('admin_update_sangoub_request', {
  p_id: input.id, p_actor_id: actor.uid, p_expected_status: input.expectedStatus, p_expected_version: input.expectedVersion,
  p_status: input.status, p_note: input.note.trim(),
 });
 if (error) {
  if (error.message?.includes('SANGOUB_REQUEST_NOT_FOUND')) throw new AdminError(404,'الطلب غير موجود.');
  if (error.message?.includes('SANGOUB_REQUEST_STALE')) throw new AdminError(409,'تغيرت حالة الطلب؛ حدّث القائمة قبل المتابعة.');
  throw new AdminError(503,'تعذر حفظ المتابعة في Supabase.');
 }
 return { ok: true };
}
