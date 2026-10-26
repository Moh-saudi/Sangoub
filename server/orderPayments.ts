import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { GeideaGateway } from "./integrations.ts";
export async function ensureOrderPayment(
  db: Firestore,
  id: string,
  email: string,
  uid: string,
) {
  const ref = db.doc("orderPayments/" + id);
  const claim = await db.runTransaction<Record<string, any>>(async (tx) => {
    const [order, payment] = await Promise.all([
      tx.get(db.doc("orders/" + id)),
      tx.get(ref),
    ]);
    if (
      !order.exists ||
      order.data()?.profileId !== uid ||
      order.data()?.paymentMethod !== "geidea" ||
      order.data()?.orderStatus === "cancelled"
    )
      throw new Error("PAYMENT_ORDER_INVALID");
    if (order.data()?.paymentStatus === "paid")
      return { state: "paid", order: order.data()! };
    if (payment.exists) return { ...payment.data(), order: order.data()! };
    tx.create(ref, {
      state: "creating",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { state: "new", order: order.data()! };
  });
  if (claim.state === "paid") return { alreadyPaid: true };
  if (claim.state === "ready")
    return {
      sessionId: claim.sessionId,
      redirectUrl: claim.redirectUrl || null,
    };
  if (claim.state !== "new")
    return {
      error:
        "تعذر تأكيد جلسة الدفع. احتفظ برقم الطلب وتواصل مع الدعم قبل المحاولة بطلب جديد.",
    };
  const result = await GeideaGateway.createOrderPayment({
    orderId: id,
    amount: claim.order.total,
    currency: "EGP",
    customerEmail: email,
    customerName: claim.order.profileName,
    returnUrl: `${process.env.APP_URL || "https://capital-talabat.vercel.app"}/checkout/success?orderId=${encodeURIComponent(id)}`,
  });
  let redirectUrl: string | null = null;
  if (result.success && result.redirectUrl) {
    try {
      const url = new URL(result.redirectUrl);
      if (
        url.protocol === "https:" &&
        (url.hostname === "merchant.geidea.net" ||
          url.hostname.endsWith(".merchant.geidea.net"))
      )
        redirectUrl = url.href;
    } catch {
      /* SDK session remains available. */
    }
  }
  if (!result.success || (!result.sessionId && !redirectUrl)) {
    await ref.update({
      state: "uncertain",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      error:
        "لم تكتمل تهيئة الدفع. طلبك محفوظ وغير مدفوع؛ تواصل مع الدعم برقم الطلب.",
    };
  }
  await ref.update({
    state: "ready",
    referenceId: result.referenceId,
    providerId:typeof result.orderId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(result.orderId)?result.orderId:null,
    sessionId: result.sessionId || null,
    redirectUrl,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { sessionId: result.sessionId || null, redirectUrl };
}
