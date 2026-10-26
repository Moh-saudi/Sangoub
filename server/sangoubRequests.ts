import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminServices } from './firebaseAdmin.ts';
import { AdminError, adminError, type requireAdmin } from './adminRequest.ts';
import { requireSameOriginJson } from './publicRequest.ts';
import { buildBreakfastMessage, breakfastLines, breakfastCount, requestMenu, normalizeRequestPhone, type BreakfastDraft } from '../src/utils/breakfastOrder.ts';
import { requestStatuses } from '../src/types/sangoubRequest.ts';
import { auditInTransaction, auditSafe } from './audit.ts';
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
export async function submitSangoubRequest(req:any,res:any) {
 try {
  requireSameOriginJson(req);
  const input=req.body;
  if (!input || Object.keys(input).some(key=>!['action','id','kind','draft'].includes(key)) || typeof input.id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id||'') || !['breakfast','supermarket'].includes(input.kind)) throw new AdminError(400,'بيانات الطلب غير صالحة.');
  const d=input.draft;
  if (!d || Object.keys(d).some(key=>!['quantities','name','phone','address','office','notes','payment'].includes(key)) || !d.quantities || typeof d.quantities!=='object' || Array.isArray(d.quantities) || Object.keys(d.quantities).length>60 || typeof d.phone!=='string' || d.phone.length>30 || ['name','phone','address','office','notes','payment'].some(key=>typeof d[key]!=='string')) throw new AdminError(400,'راجع بيانات الطلب.');
  let draft:BreakfastDraft;
  try { draft={...d,phone:normalizeRequestPhone(d.phone),name:d.name.trim(),address:d.address.trim(),office:d.office.trim(),notes:d.notes.trim()};buildBreakfastMessage(draft,requestMenu(input.kind)); } catch(e) { throw new AdminError(400,(e as Error).message); }
  const items=breakfastLines(draft.quantities,requestMenu(input.kind));
  const data={kind:input.kind,name:draft.name,phone:draft.phone,address:draft.address,office:draft.office,notes:draft.notes,payment:draft.payment,items,totalQuantity:breakfastCount(draft.quantities,requestMenu(input.kind))};
  const fingerprint=hash(JSON.stringify(data));
  const {db}=adminServices(), ref=db.doc('sangoubRequests/SNG-'+input.id.toLowerCase()), limit=db.doc('sangoubRequestLimits/'+hash(draft.phone!));
  await db.runTransaction(async tx=>{
   const existing=await tx.get(ref);
   if(existing.exists){if(existing.data()?.fingerprint!==fingerprint)throw new AdminError(409,'تغيرت بيانات الطلب؛ راجع الطلب وأعد المحاولة.');return;}
   const quota=await tx.get(limit);
   const recent=quota.data()?.startedAt>Date.now()-86400000;
   if(recent&&quota.data()!.count>=10)throw new AdminError(429,'بلغت الحد اليومي للطلبات. تواصل مع الدعم.');
   tx.create(ref,{...data,fingerprint,status:'new',version:1,source:'sangoub-web',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
   tx.set(limit,{startedAt:recent?quota.data()!.startedAt:Date.now(),count:recent?quota.data()!.count+1:1});
  });
  return res.status(200).json({id:ref.id});
 } catch(e){return adminError(res,e);}
}
export async function adminSangoubRequests(input:any, context:Awaited<ReturnType<typeof requireAdmin>>) {
 const {db,actor}=context;
 const allowed=input.action==='sangoub-list'?['action','cursor']:['action','id','status','note','expectedStatus','expectedVersion'];
 if(Object.keys(input).some(key=>!allowed.includes(key)))throw new AdminError(400,'حقول متابعة غير صالحة.');
 if(input.action==='sangoub-list'){
  let query=db.collection('sangoubRequests').orderBy('createdAt','desc');
  if(input.cursor){if(typeof input.cursor!=='string'||!/^SNG-[a-f0-9-]{36}$/.test(input.cursor))throw new AdminError(400,'مؤشر غير صالح.');const cursor=await db.doc('sangoubRequests/'+input.cursor).get();if(!cursor.exists)throw new AdminError(400,'مؤشر غير صالح.');query=query.startAfter(cursor);}
  const snapshot=await query.limit(26).get(), docs=snapshot.docs.slice(0,25);
  return {requests:docs.map(doc=>{const {fingerprint,...data}=doc.data();return {id:doc.id,...auditSafe(data)};}),nextCursor:snapshot.size>25?docs.at(-1)!.id:null};
 }
 if(!/^SNG-[a-f0-9-]{36}$/.test(input.id||'') || !requestStatuses.includes(input.status) || typeof input.note!=='string'||input.note.length>500||!input.note.trim())throw new AdminError(400,'اختر الحالة واكتب ملاحظة المتابعة.');
 await db.runTransaction(async tx=>{
  const ref=db.doc('sangoubRequests/'+input.id);
  const [record,own,access]=await Promise.all([tx.get(ref),tx.get(db.doc('admins/'+actor.uid)),tx.get(db.doc('accountAccess/'+actor.uid))]);
  if(!own.exists||access.data()?.disabled||access.data()?.operationLocked||actor.auth_time<=(access.data()?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الإدارة.');
  if(!record.exists)throw new AdminError(404,'الطلب غير موجود.');
  const before=record.data()!;
  if(before.status!==input.expectedStatus || (before.version||1)!==input.expectedVersion)throw new AdminError(409,'تغيرت حالة الطلب؛ حدّث القائمة قبل المتابعة.');
  tx.update(ref,{status:input.status,version:(before.version||1)+1,adminNote:input.note.trim(),updatedAt:FieldValue.serverTimestamp()});
  auditInTransaction(db,tx,actor,'sangoub.followup','sangoubRequests',input.id,{status:before.status},{status:input.status,note:input.note.trim()});
 });
 return {ok:true};
}
