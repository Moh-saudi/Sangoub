import { writeOrderSignals } from '../orderSignals.ts';
import { auditInTransaction, attachAuditContext } from "../audit.ts";
import { FieldValue } from "firebase-admin/firestore";
import { adminServices } from "../firebaseAdmin.ts";
import { closeOperationalQueues, paymentReady, ticketRef } from "../operations.ts";
import { mobileCors } from "../mobileCors.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ error: "يرجى تسجيل الدخول." });
  const { orderId, action, otpCode, collectedAmount } = req.body || {};
  if (typeof orderId !== "string" || !/^[\w-]{1,256}$/.test(orderId) || !["code", "deliver"].includes(action))
    return res.status(400).json({ error: "بيانات التسليم غير صالحة." });
  try {
    const { auth, db } = adminServices();
    let user;
    try { user = await auth.verifyIdToken(bearer, true); }
    catch { return res.status(401).json({ error: "جلسة الدخول غير صالحة." }); }
    const access=(await db.doc('accountAccess/'+user.uid).get()).data();
    if(access?.disabled||access?.operationLocked||user.auth_time<=(access?.revokedBefore||0))return res.status(401).json({error:'أُلغيت هذه الجلسة أو عُلّق الحساب. سجل الدخول من جديد.'});
    attachAuditContext(req,user);
    if (action === "deliver" && !user.email_verified && !user.phone_number) return res.status(403).json({ error: "أكد حسابك أولًا." });
    const orderRef = db.collection("orders").doc(orderId);
    const secretRef = db.collection("orderSecrets").doc(orderId);
    const result = await db.runTransaction(async (tx) => {
      const [orderDoc, secretDoc, staff, currentAccess] = await Promise.all([
        tx.get(orderRef), tx.get(secretRef), tx.get(db.collection("staff").doc(user.uid)), tx.get(db.doc("accountAccess/"+user.uid)),
      ]);
      const control=currentAccess.data();
      if(control?.disabled||control?.operationLocked||user.auth_time<=(control?.revokedBefore||0))return {status:403,body:{error:'انتهت صلاحية الحساب.'}};
      if (!orderDoc.exists) return { status: 404, body: { error: "الطلب غير موجود." } };
      const order = orderDoc.data()!;
      if (action === "code") {
        if (order.profileId !== user.uid) return { status: 403, body: { error: "رمز الاستلام لصاحب الطلب فقط." } };
        if (!secretDoc.exists || ["cancelled", "delivered"].includes(order.orderStatus))
          return { status: 409, body: { error: "رمز الاستلام غير متاح لهذا الطلب." } };
        return { status: 200, body: { otpCode: secretDoc.data()!.otpCode } };
      }
      if (order.courierId !== user.uid || staff.data()?.role !== "courier")
        return { status: 403, body: { error: "التسليم للمندوب المكلّف فقط." } };
      if (order.orderStatus === "delivered") return { status: 200, body: { ok: true } };
      if (order.orderStatus !== "with_courier" || !secretDoc.exists)
        return { status: 409, body: { error: "الطلب غير متاح للتسليم بالرمز. راجع الإدارة." } };
      if(order.fulfillmentVersion===2){
        const tickets=await Promise.all((order.storeIds||[]).map((storeId:string)=>tx.get(ticketRef(db,orderId,storeId))));
        if(!tickets.length||tickets.some(ticket=>ticket.data()?.status!=='picked_up'||ticket.data()?.pickedUpBy!==user.uid))return {status:409,body:{error:'لم يكتمل تأكيد الاستلام من جميع المتاجر.'}};
      }
      const secret = secretDoc.data()!;
      const locked = secret.lockedUntil?.toMillis?.() > Date.now();
      if (locked) return { status: 429, body: { error: "محاولات كثيرة. انتظر 15 دقيقة ثم تحقق مع العميل." } };
      if (typeof otpCode !== "string" || !/^\d{4}$/.test(otpCode) || otpCode !== secret.otpCode) {
        const attempts = (secret.attempts || 0) + 1;
        tx.update(secretRef, { attempts: attempts >= 5 ? 0 : attempts,
          ...(attempts >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60000) } : {}),
        });
        return { status: 400, body: { error: "رمز الاستلام غير صحيح." } };
      }
      if(order.paymentMethod==='cash'){
        if(!Number.isFinite(collectedAmount)||Math.abs(collectedAmount-order.total)>0.01)return {status:400,body:{error:'أكّد تحصيل قيمة الطلب النقدية كاملة.'}};
      }else if(!paymentReady(order)||collectedAmount!==0)return {status:400,body:{error:'يلزم تأكيد الدفع الإلكتروني دون تحصيل نقدي إضافي.'}};

      tx.update(orderRef, { orderStatus: "delivered", deliveredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), paymentStatus: "paid",
        courierChecklist: { ...order.courierChecklist, collectedPayment: true, collectedAmount, arrivedAtCustomerOffice: true },
      });
      writeOrderSignals(db,tx,{...order,id:orderId,orderStatus:"delivered"},{...order,id:orderId});
      auditInTransaction(db,tx,user,"orders.delivered","orders",orderId,{orderStatus:order.orderStatus,paymentStatus:order.paymentStatus},{orderStatus:"delivered",paymentStatus:"paid",collectedAmount},"","delivery-api");
      if(order.fulfillmentVersion===2)closeOperationalQueues(db,tx,{...order,id:orderId});
      tx.delete(secretRef);
      return { status: 200, body: { ok: true } };
    });
    return res.status(result.status).json(result.body);
  } catch { return res.status(503).json({ error: "خدمة تأكيد التسليم غير متاحة حاليًا." }); }
}
