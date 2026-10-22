import { auditInTransaction, attachAuditContext } from "../audit.ts";
import { FieldValue } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { adminServices } from "../firebaseAdmin.ts";
import { buildOrder } from "../orderBuilder.ts";
import { mobileCors } from "../mobileCors.ts";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (mobileCors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ error: "يرجى تسجيل الدخول." });
  try {
    const { auth, db } = adminServices();
    let identity;
    try {
      identity = await auth.verifyIdToken(bearer, true);
    } catch {
      return res
        .status(401)
        .json({ error: "جلسة الدخول غير صالحة. سجّل الدخول مجددًا." });
    }
    const access=(await db.doc('accountAccess/'+identity.uid).get()).data();
    if(access?.disabled||access?.operationLocked||identity.auth_time<=(access?.revokedBefore||0))return res.status(401).json({error:'أُلغيت هذه الجلسة أو عُلّق الحساب. سجل الدخول من جديد.'});
    attachAuditContext(req,identity);
    if (!identity.email_verified && !identity.phone_number)
      return res.status(403).json({ error: "يرجى تأكيد البريد أو الهاتف." });
    const input = req.body;
    if (
      !input ||
      typeof input.id !== "string" ||
      !/^ord-[a-f0-9-]{36}$/.test(input.id) ||
      !Array.isArray(input.items) ||
      input.items.length > 50 ||
      !input.items.length
    )
      return res.status(400).json({ error: "بيانات الطلب غير صالحة." });
    if (
      input.items.some(
        (i: any) =>
          typeof i?.product?.id !== "string" ||
          !/^[\w-]{1,128}$/.test(i.product.id),
      ) ||
      (input.couponCode && !/^[\w-]{1,40}$/.test(input.couponCode))
    )
      return res.status(400).json({ error: "معرّف صنف أو خصم غير صالح." });
    const ref = db.collection("orders").doc(`${identity.uid}_${input.id}`);
    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) return existing.data();
      const quotaRef = db.collection("orderLimits").doc(identity.uid);
      const quota = await tx.get(quotaRef);
      const windowStart = Date.now() - 24 * 60 * 60 * 1000;
      const recent = quota.data()?.startedAt > windowStart;
      if (recent && quota.data()!.count >= 30)
        throw new Error("ORDER_RATE_LIMIT");
      const profile = await tx.get(db.collection("users").doc(identity.uid));
      if (!profile.exists) throw new Error("أكمل بيانات الحساب أولًا.");
      const productIds = [
        ...new Set<string>(input.items.map((i: any) => i.product.id)),
      ];
      const productDocs = await Promise.all(
        productIds.map((id) => tx.get(db.collection("products").doc(id))),
      );
      const products = new Map(
        productDocs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...d.data(), id: d.id } as any]),
      );
      const storeIds = [
        ...new Set<string>(Array.from(products.values()).map((p) => p.storeId)),
      ];
      const storeDocs = await Promise.all(
        storeIds.map((id) => tx.get(db.collection("stores").doc(id))),
      );
      const stores = new Map(
        storeDocs
          .filter((d) => d.exists)
          .map((d) => [d.id, { ...d.data(), id: d.id } as any]),
      );
      const coupon = input.couponCode
        ? (await tx.get(db.collection("coupons").doc(input.couponCode))).data()
        : undefined;
      const order = buildOrder(
        input,
        identity.uid,
        products,
        stores,
        coupon as any,
      );
      order.id = ref.id;
      tx.set(quotaRef, {
        startedAt: recent ? quota.data()!.startedAt : Date.now(),
        count: recent ? quota.data()!.count + 1 : 1,
      });
      tx.create(ref, {
        ...order,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(db.collection("orderSecrets").doc(ref.id), {
        otpCode: randomInt(1000, 10000).toString(), attempts: 0,
      });
      auditInTransaction(db, tx, identity, "orders.create", "orders", ref.id, null, order, "", "orders-api");
      return order;
    });
    return res
      .status(200)
      .json({
        order: {
          ...result,
          createdAt: result?.createdAt?.toDate
            ? result.createdAt.toDate().toISOString()
            : result?.createdAt,
        },
      });
  } catch (error: any) {
    if (error.message === "ORDER_RATE_LIMIT")
      return res
        .status(429)
        .json({ error: "تجاوزت عدد الطلبات اليومي. تواصل مع الدعم." });
    const infrastructure =
      /credential|permission|PERMISSION_DENIED|UNAUTHENTICATED|default credentials|ENOTFOUND|project.*not found|NOT_FOUND|network/i.test(
        error.message || "",
      );
    if (infrastructure) {
      console.error(
        "Order infrastructure failure:",
        error.code || "unavailable",
      );
      return res
        .status(503)
        .json({
          error: "خدمة الطلبات غير متاحة حاليًا. يرجى المحاولة لاحقًا.",
        });
    }
    return res.status(400).json({ error: error.message || "تعذر حفظ الطلب." });
  }
}
