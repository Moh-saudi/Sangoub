import { FieldValue } from "firebase-admin/firestore";
import { adminServices } from "../../server/firebaseAdmin.ts";
import { GeideaGateway, ChatAmanGateway } from "../../server/integrations.ts";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const payload = req.body || {},
      providerId = payload.orderId || payload.order?.orderId;
    if (
      typeof providerId !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(providerId)
    )
      return res.status(400).json({ error: "بيانات الدفع غير صالحة." });
    const { db } = adminServices();
    let id = payload.metadata?.orderId || payload.order?.metadata?.orderId;
    const reference =
      payload.merchantReferenceId || payload.order?.merchantReferenceId;
    if (
      !id &&
      typeof reference === "string" &&
      /^SNG_[a-f0-9]{24}$/.test(reference)
    ) {
      const found = await db
        .collection("orderPayments")
        .where("referenceId", "==", reference)
        .limit(1)
        .get();
      id = found.docs[0]?.id;
    }
    if(!id){const found=await db.collection('orderPayments').where('providerId','==',providerId).limit(1).get();id=found.docs[0]?.id;}
    if (typeof id !== "string" || !/^[\w-]{1,200}$/.test(id))
      return res.status(400).json({ error: "مرجع الطلب غير صالح." });
    const [order, payment] = await db.getAll(
      db.doc("orders/" + id),
      db.doc("orderPayments/" + id),
    );
    if (
      !order.exists ||
      order.data()?.paymentMethod !== "geidea" ||
      !payment.data()?.referenceId
    )
      return res
        .status(409)
        .json({ error: "الدفع يحتاج مراجعة مرجعه على الخادم." });
    const verified = await GeideaGateway.verifyOrderPayment(providerId, {
      referenceId: payment.data()!.referenceId,
      amount: order.data()!.total,
      currency: "EGP",
    });
    const newlyPaid = await db.runTransaction(async (tx) => {
      const [current, session, used] = await Promise.all([
        tx.get(order.ref),
        tx.get(payment.ref),
        tx.get(db.doc("geideaTransactions/" + providerId)),
      ]);
      if (used.exists && used.data()?.orderId !== id)
        throw new Error("PAYMENT_ALREADY_USED");
      if (
        session.data()?.referenceId !== verified.referenceId ||
        current.data()?.total !== verified.amount ||
        current.data()?.paymentMethod !== "geidea"
      )
        throw new Error("PAYMENT_CHANGED");
      if (current.data()?.paymentStatus === "paid") return false;
      tx.update(order.ref, {
        ...(Array.isArray(current.data()?.pendingStoreIds)
          ? {
              storeIds: current.data()!.pendingStoreIds,
              pendingStoreIds: FieldValue.delete(),
            }
          : {}),
        paymentStatus: "paid",
        paymentConfirmedAt: FieldValue.serverTimestamp(),
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        geideaTransaction: verified,
      });
      tx.update(payment.ref, {
        state: "paid",
        providerId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.doc("geideaTransactions/" + providerId), {
        orderId: id,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (
      newlyPaid &&
      order.data()?.phone &&
      !process.env.FIRESTORE_EMULATOR_HOST
    )
      void ChatAmanGateway.sendDirectMessage(
        order.data()!.phone,
        `تم تأكيد سداد طلب سنجوب ${order.data()!.orderNumber || id} بقيمة ${verified.amount} ج.م عبر جيديا.`,
      ).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch {
    return res
      .status(409)
      .json({ error: "لم يؤكد الخادم سداد هذا الطلب بعد." });
  }
}
