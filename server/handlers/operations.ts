import { portalOrderActions, portalOrders } from '../portalOrders.ts';
import { writeOrderSignals } from '../orderSignals.ts';
import {merchantActions,merchantAction} from '../merchantActions.ts';
import { FieldValue } from 'firebase-admin/firestore';
import { AdminError, adminError, validId } from '../adminRequest.ts';
import { auditInTransaction, auditSafe } from '../audit.ts';
import { mobileCors } from '../mobileCors.ts';
import { assignmentRef, closeOperationalQueues, operationIdentity, paymentReady, preparationView, queueRef, requireOperationalAccess, rolloutReady, terminal, ticketRef } from '../operations.ts';

export default async function handler(req: any, res: any) {
 res.setHeader('Cache-Control', 'no-store'); if (mobileCors(req, res)) return;
 if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 try {
  const context = await operationIdentity(req); const { db, actor, role, staff } = context; const input = req.body || {};
  if (input.action === 'profile') {
   const store = role === 'restaurant' && staff?.storeId ? (await db.doc('stores/' + staff.storeId).get()).data() : null;
   return res.status(200).json({ uid: actor.uid, role, duty: role === 'restaurant' ? staff?.duty || 'manager' : null, storeId: staff?.storeId || null,
    store: store ? { id: staff!.storeId, name: store.name, category: store.category, status: store.status, preparationType: store.category === 'supermarket' ? 'picking' : 'kitchen' } : null,
    displayName: context.profile?.fullName || actor.name || '', needsVerification: !context.verified,
    destination: role === 'admin' ? 'admin_web' : role === 'restaurant' ? 'store_preparation' : role === 'courier' ? 'courier_tasks' : 'customer_home',
    capabilities: ['operations_v2'], rolloutReady: rolloutReady(), requiresStoreAssignment: role === 'restaurant' && !store });
  }
  if(portalOrderActions.includes(input.action))return res.status(200).json(await portalOrders(input,context));
  if(merchantActions.includes(input.action))return res.status(200).json(await merchantAction(input,context));
  if(input.action==='cancel'){
   validId(input.orderId);
   await db.runTransaction(async tx=>{
    const [doc,access]=await Promise.all([tx.get(db.doc('orders/'+input.orderId)),tx.get(db.doc('accountAccess/'+actor.uid))]);
    const control=access.data();if(control?.disabled||control?.operationLocked||actor.auth_time<=(control?.revokedBefore||0))throw new AdminError(403,'انتهت صلاحية الجلسة.');
    if(!doc.exists)throw new AdminError(404,'الطلب غير موجود.');
    const order:any={...doc.data(),id:doc.id};if(order.profileId!==actor.uid)throw new AdminError(403,'الإلغاء لصاحب الطلب فقط.');
    if(order.fulfillmentVersion!==2)throw new AdminError(409,'استخدم مسار الطلب السابق.');
    if(order.orderStatus==='cancelled')return;
    if(order.orderStatus!=='received')throw new AdminError(409,'بدأ تحضير الطلب؛ تواصل مع الإدارة لمراجعته.');
    const tickets=await Promise.all((order.storeIds||[]).map((storeId:string)=>tx.get(ticketRef(db,order.id,storeId))));
    if(tickets.some(ticket=>ticket.data()?.status!=='received'))throw new AdminError(409,'بدأ تحضير الطلب.');
    for(const ticket of tickets)tx.update(ticket.ref,{status:'cancelled',updatedAt:FieldValue.serverTimestamp()});
    tx.update(doc.ref,{orderStatus:'cancelled',updatedAt:FieldValue.serverTimestamp()});closeOperationalQueues(db,tx,order);
    writeOrderSignals(db,tx,{...order,orderStatus:'cancelled'},order);
    auditInTransaction(db,tx,actor,'orders.cancelled','orders',order.id,{orderStatus:'received'},{orderStatus:'cancelled'});
   });return res.status(200).json({ok:true});
  }
  requireOperationalAccess(context);
  if(input.action==='inspect'){
   if(role!=='admin')throw new AdminError(403,'المتابعة الشاملة للإدارة فقط.');
   validId(input.orderId);const order=await db.doc('orders/'+input.orderId).get();
   if(!order.exists)throw new AdminError(404,'الطلب غير موجود.');
   const tickets=await Promise.all((order.data()!.storeIds||[]).map((storeId:string)=>ticketRef(db,order.id,storeId).get()));
   return res.status(200).json({tickets:tickets.filter(ticket=>ticket.exists).map(ticket=>auditSafe(ticket.data()))});
  }
  if (input.action === 'list') {
   if (!['restaurant', 'courier'].includes(role)) throw new AdminError(400, 'تستخدم الإدارة شاشة متابعة التشغيل.');
   const collection = role === 'restaurant' ? (validId(staff?.storeId), db.collection(`stores/${staff!.storeId}/preparationQueue`)) : db.collection(`courierAssignments/${actor.uid}/orders`);
   let query = collection.where('active', '==', true).limit(51);
   if (input.cursor) { validId(input.cursor); const cursor = await collection.doc(input.cursor).get(); if (!cursor.exists) throw new AdminError(400, 'صفحة غير صالحة.'); query = query.startAfter(cursor); }
   const snapshot = await query.get(); const entries = snapshot.docs.slice(0, 50); const items = [];
   for (const entry of entries) {
    const orderDoc = await db.doc('orders/' + entry.id).get(); if (!orderDoc.exists) continue;
    const order: any = { ...orderDoc.data(), id: orderDoc.id }; if (order.fulfillmentVersion !== 2 || terminal(order.orderStatus)) continue;
    if (role === 'restaurant') {
     if (!order.storeIds?.includes(staff!.storeId)) continue;
     const ticket = await ticketRef(db, order.id, staff!.storeId).get(); if (ticket.exists) items.push(preparationView(ticket.data(), order));
    } else if (order.courierId === actor.uid) {
     const tickets = await Promise.all(order.storeIds.map((id: string) => ticketRef(db, order.id, id).get()));
     const stores = await Promise.all(order.storeIds.map((id: string) => db.doc('stores/' + id).get()));
     items.push(auditSafe({ id: order.id, orderNumber: order.orderNumber, orderStatus: order.orderStatus, profileName: order.profileName, phone: order.phone,
      ministry: order.ministry, floorNumber: order.floorNumber, roomNumber: order.roomNumber, coordinates: order.coordinates || null,
      total: order.total, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus,
      amountToCollect: order.paymentMethod === 'cash' ? order.total : 0,
      stops: tickets.map((ticket, i) => ({ ...ticket.data(), location: stores[i].data()?.locationInDistrict || '' })) }));
    }
   }
   return res.status(200).json({ items, nextCursor: snapshot.size > 50 ? entries.at(-1)?.id : null });
  }
  if (!['prepare', 'report-issue', 'resolve-issue', 'pickup', 'depart'].includes(input.action)) throw new AdminError(400, 'عملية تشغيل غير معروفة.');
  validId(input.orderId);
  await db.runTransaction(async tx => {
   // Check access and assignment again inside the transaction to serialize role revocation.
   const [orderDoc, currentStaff, currentAccess, currentAdmin] = await Promise.all([tx.get(db.doc('orders/' + input.orderId)), tx.get(db.doc('staff/' + actor.uid)), tx.get(db.doc('accountAccess/' + actor.uid)), tx.get(db.doc('admins/' + actor.uid))]);
   const control = currentAccess.data();
   if (control?.disabled || control?.operationLocked || actor.auth_time <= (control?.revokedBefore || 0)) throw new AdminError(403, 'انتهت صلاحية هذه الجلسة.');
   const currentRole = currentAdmin.exists ? 'admin' : currentStaff.data()?.role;
   if (currentRole !== role) throw new AdminError(403, 'تغيرت صلاحيات الحساب. سجل الدخول مجددًا.');
   if (!orderDoc.exists) throw new AdminError(404, 'الطلب غير موجود.');
   const order: any = { ...orderDoc.data(), id: orderDoc.id };
   if (order.fulfillmentVersion !== 2) throw new AdminError(409, 'هذا طلب سابق؛ استخدم مسار التشغيل القديم.');
   if (terminal(order.orderStatus)) throw new AdminError(409, 'الطلب مغلق.');
   const storeIds: string[] = order.storeIds || [];
   const tickets = await Promise.all(storeIds.map(id => tx.get(ticketRef(db, order.id, id))));
   if (tickets.some(ticket => !ticket.exists)) throw new AdminError(409, 'تذاكر الطلب غير مكتملة. راجع الإدارة.');
   if(input.action==='resolve-issue'){
    if(role!=='admin')throw new AdminError(403,'معالجة المشكلة للإدارة فقط.');
    validId(input.storeId);const index=storeIds.indexOf(input.storeId);
    if(index<0)throw new AdminError(400,'المتجر ليس ضمن الطلب.');
    if(typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500)throw new AdminError(400,'اكتب نتيجة المراجعة.');
    tx.update(tickets[index].ref,{issueOpen:false,resolution:input.reason.trim(),resolvedBy:actor.uid,updatedAt:FieldValue.serverTimestamp()});
    writeOrderSignals(db,tx,order,order);
    auditInTransaction(db,tx,actor,'fulfillment.issue.resolved','orders',order.id,null,{storeId:input.storeId,reason:input.reason.trim()});return;
   }
   if (['prepare', 'report-issue'].includes(input.action)) {
    const storeId = currentStaff.data()?.storeId;
    if (role !== 'restaurant' || !storeIds.includes(storeId) || (input.storeId && input.storeId !== storeId)) throw new AdminError(403, 'هذه التذكرة تخص متجرًا آخر.');
    const index = storeIds.indexOf(storeId); const ticket = tickets[index].data()!;
    if (ticket.status === 'picked_up') throw new AdminError(409, 'المندوب استلم هذه التذكرة بالفعل.');
    if (input.action === 'report-issue') {
     if (typeof input.reason !== 'string' || input.reason.trim().length < 5 || input.reason.length > 500) throw new AdminError(400, 'اشرح المشكلة في حدود 500 حرف.');
     tx.update(tickets[index].ref, { issue: input.reason.trim(), issueOpen: true, updatedAt: FieldValue.serverTimestamp() });
     writeOrderSignals(db,tx,order,order);
     auditInTransaction(db, tx, actor, 'fulfillment.issue', 'orders', order.id, null, { storeId, reason: input.reason.trim() }); return;
    }
    if(ticket.issueOpen)throw new AdminError(409,'تحتاج التذكرة مراجعة الإدارة قبل متابعة التحضير.');
    if (!paymentReady(order)) throw new AdminError(409, 'بانتظار تأكيد الدفع قبل بدء التحضير.');
    if (!['preparing', 'ready'].includes(input.next)) throw new AdminError(400, 'حالة التحضير غير صالحة.');
    if (ticket.status === input.next) return; // Safe retry after lost acknowledgement.
    if ((input.next === 'preparing' && ticket.status !== 'received') || (input.next === 'ready' && ticket.status !== 'preparing')) throw new AdminError(409, 'تغيرت حالة التذكرة. حدّث القائمة.');
    const checked = input.checkedItemIds || [];
    const expected = ticket.items.map((item: any, i: number) => item.id || String(i));
    if (input.next === 'ready' && (!Array.isArray(checked) || checked.length !== expected.length || new Set(checked).size !== expected.length || !expected.every((id: string) => checked.includes(id)))) throw new AdminError(400, 'راجع جميع أصناف التذكرة وكمياتها قبل إعلان الجاهزية.');
    const allReady = tickets.every((doc, i) => i === index || ['ready', 'picked_up'].includes(doc.data()!.status));
    tx.update(tickets[index].ref, { status: input.next, preparedBy: actor.uid, preparedByName: String(currentStaff.data()?.name || '').slice(0,120), checkedItemIds: input.next === 'ready' ? checked : [], updatedAt: FieldValue.serverTimestamp(), ...(input.next === 'ready' ? { readyAt: FieldValue.serverTimestamp() } : {}) });
    tx.update(orderDoc.ref, { kitchenStatus: { ...order.kitchenStatus, [storeId]: input.next }, orderStatus: input.next === 'ready' && allReady ? 'ready' : 'preparing', updatedAt: FieldValue.serverTimestamp(), ...(input.next === 'ready' && allReady ? { readyAt: FieldValue.serverTimestamp() } : {}) });
    writeOrderSignals(db,tx,{...order,orderStatus:input.next==='ready'&&allReady?'ready':'preparing'},order);
    auditInTransaction(db, tx, actor, 'fulfillment.' + input.next, 'orders', order.id, { storeId, status: ticket.status }, { storeId, status: input.next }); return;
   }
   if (role !== 'courier' || order.courierId !== actor.uid) throw new AdminError(403, 'الطلب لمندوب آخر.');
   if (!paymentReady(order)) throw new AdminError(409, 'بانتظار تأكيد الدفع.');
   if (input.action === 'pickup') {
    validId(input.storeId); const index = storeIds.indexOf(input.storeId);
    if (index < 0) throw new AdminError(403, 'المتجر ليس ضمن نقاط هذا الطلب.');
    const ticket = tickets[index].data()!;
    if (ticket.status === 'picked_up') return;
    if (order.orderStatus !== 'ready' || ticket.status !== 'ready' || ticket.issueOpen) throw new AdminError(409, 'المتجر لم يؤكد جاهزية الأصناف.');
    if (input.confirmed !== true) throw new AdminError(400, 'أكد مراجعة الأصناف والكميات عند الاستلام.');
    tx.update(tickets[index].ref, { status: 'picked_up', pickedUpBy: actor.uid, pickedUpByName: String(currentStaff.data()?.name || '').slice(0,120), pickedUpAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(queueRef(db, input.storeId, order.id), { active: false }, { merge: true });
    tx.update(orderDoc.ref,{pickedUpStoreIds:FieldValue.arrayUnion(input.storeId),updatedAt:FieldValue.serverTimestamp()});
    writeOrderSignals(db,tx,order,order);
    auditInTransaction(db, tx, actor, 'fulfillment.picked_up', 'orders', order.id, { storeId: input.storeId, status: ticket.status }, { storeId: input.storeId, status: 'picked_up' }); return;
   }
   if (order.orderStatus === 'with_courier') return;
   if (order.orderStatus !== 'ready' || tickets.some(ticket => ticket.data()!.status !== 'picked_up')) throw new AdminError(409, 'أكد الاستلام من جميع المتاجر قبل بدء التوصيل.');
   tx.update(orderDoc.ref, { orderStatus: 'with_courier', departedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
   writeOrderSignals(db,tx,{...order,orderStatus:'with_courier'},order);
   auditInTransaction(db, tx, actor, 'orders.departed', 'orders', order.id, { orderStatus: 'ready' }, { orderStatus: 'with_courier' });
  });
  return res.status(200).json({ ok: true });
 } catch (error) { return adminError(res, error); }
}
